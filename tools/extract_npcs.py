"""Extrae del PDF del libro básico (castellano) las 10 fichas de «Tipejos y reclutas» (PDF 416–420) y las tres tablas de
encuentros de Night City (PDF 421–429) y genera data/npcs.json y data/encounters.json. Claude Code, paso 6 del generador.
Uso (desde la raíz del módulo): python -I -W ignore tools/extract_npcs.py   (requiere pymupdf)

Validaciones (el script se detiene ante cualquier fallo):
- PD = 10 + 5 × ⌈(VOL + TCO) / 2⌉, Gravemente herido = ⌈PD / 2⌉ y Salvación contra muerte = TCO (reglas de RED);
- nivel de cada habilidad = base − característica, entre 0 y 10;
- tablas de encuentros: rangos 1–100 completos, sin huecos ni solapes; cada «Usa …» remite a una de las 10 fichas.
Los nombres de objetos se resuelven a Items nativos de RED con: (1) los enlaces del Core en español, (2) los nombres de
cyberpunk-tr-esp, (3) ALIAS. Lo que no se resuelve queda como texto (nota en la ficha) y se informa."""
import hashlib, json, math, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / 'documentos/Ciberpunk RED - Libro básico.pdf'
CORE = ROOT / '02-edgerunners-world/staging/P02A21-audit-fixes-101/cyberpunk-red-core-esp/source/journals.json'
TR = ROOT / '05-cyberpunk-tr-esp/compendium/es'
OUT = Path(__file__).resolve().parents[1] / 'data'
SKILLS = json.loads((OUT / 'skills.json').read_text(encoding='utf8'))

def die(m): sys.exit('ERROR: ' + m)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(s): return re.sub(r'\s+', ' ', s.replace('®', '').replace('™', '')).strip().lower()

# --- Diccionario nombre → Item nativo -------------------------------------------------------------------------
NAMES = {}
def add_name(name, pack, iid, overwrite=False):
    k = norm(name)
    if overwrite or k not in NAMES: NAMES[k] = f'Compendium.cyberpunk-red-core.{pack}.Item.{iid}'
core = json.loads(CORE.read_text(encoding='utf8'))
for j in core['journals']:
    for p in j['pages']:
        for pack, iid, name in re.findall(r'@UUID\[Compendium\.cyberpunk-red-core\.([\w-]+)\.Item\.(\w+)\]\{([^}]*)\}', p['text']['content']):
            add_name(name, pack, iid)
for f in TR.glob('cyberpunk-red-core.core_*.json'):
    pack = f.stem.split('.', 1)[1]
    for iid, v in json.loads(f.read_text(encoding='utf8'))['entries'].items():
        if isinstance(v, dict) and v.get('name'): add_name(v['name'], pack, iid)
# Equivalencias manuales (nombre del libro → nombre de cyberpunk-tr-esp o del Core).
ALIAS = {
    'destripadores': 'desgarradores', 'kevlar': 'kevlar (cuerpo)', 'cuero': 'cuero (cuerpo)', 'ligero': 'blindaje ligero (cuerpo)',
    'mediano': 'blindaje medio (cuerpo)', 'subdérmico': 'blindaje subdérmico', 'traje bodyweight': 'traje bodyweight',
    'flechas': 'munición básica (flecha)', 'cuerda': 'cuerda (60 m)', 'rastreadores': 'rastreador', 'esposas': 'esposas',
    'munición de escopeta': 'munición básica (cartucho de escopeta)', 'munición de fusil': 'munición básica (fusil)',
    'munición de pistola mp': 'munición básica (pistola muy pesada)', 'munición de pistola muy pesada': 'munición básica (pistola muy pesada)',
    'munición de pistola p': 'munición básica (pistola pesada)', 'munición de pistola pesada': 'munición básica (pistola pesada)',
    'munición de lanzallamas (cartuchos de escopeta incendiarios)': 'munición incendiaria (cartucho de escopeta)',
    'granada incendiaria': 'munición incendiaria (granada)', 'granada cegadora': 'granada cegadora', 'granada perforante': 'munición perforante (granada)',
    'pistola mp': 'pistola muy pesada', 'pistola p': 'pistola pesada', 'ciberbrazo': 'ciberbrazo', 'ciberpierna': 'ciberpierna',
    'amplificador de imagen': 'amplificador de imagen', 'subfusil pesado oculto': 'arma a distancia oculta', 'cibervelocidad kerenzikov': 'kerenzikov',
    'atenuadores de nivel': 'atenuador de nivel',
}
def resolve(name):
    k = norm(name)
    for cand in (k, ALIAS.get(k), ALIAS.get(k, '').replace(' (cuerpo)', '')):
        if cand and cand in NAMES: return NAMES[cand]
    return None

# --- Fichas ---------------------------------------------------------------------------------------------------
NPCS = [  # clave, nombre en el PDF, nivel de amenaza (texto del libro: subalternos, lugartenientes, jefes menores, jefe)
    ('bodyguard', 'GUARDAESPALDAS', 'mook'), ('booster', 'PANDILLERO', 'mook'), ('roadGanger', 'PANDILLERO DE CARRETERA', 'mook'),
    ('securityOperative', 'OPERATIVO DE SEGURIDAD', 'mook'), ('netrunner', 'NETRUNNER', 'lieutenant'), ('reclaimerChief', 'JEFE DE RECUPERADORES', 'lieutenant'),
    ('securityOfficer', 'OFICIAL DE SEGURIDAD', 'lieutenant'), ('outrider', 'PILOTO', 'miniboss'), ('pyro', 'PIRÓMANO', 'miniboss'), ('cyberpsycho', 'CIBERPSICÓPATA', 'boss'),
]
# Orden de los valores tras las bases de habilidad (comprobado con PD/Gravemente herido/Salvación en las 10 fichas).
AFTER = ['ref', 'luck', 'dex', 'cool', 'seriouslyWounded', 'tech', 'body', 'move', 'emp', 'deathSave']
STAT_OF = {s['name']: s['stat'] for s in SKILLS.values()}
ROLE_ABILITY = {'Interface': ('netrunner', 'g5S5E8UG1QJ4yFsp'), 'Motor': ('nomad', 'E2NkaEAx8Rv4nqWQ'), 'Conciencia de combate': ('solo', 'I4qtphsiVa4rj9U8')}

doc = pymupdf.open(str(PDF))
def page_lines(a, b):
    out = []
    for i in range(a, b + 1): out += [l.rstrip() for l in doc[i - 1].get_text().split('\n')]
    return out

def first_num(v):
    v = v.strip()
    if v in ('—', '-'): return None
    m = re.match(r'^(\d+)', v) or die(f'valor ilegible {v!r}')
    return int(m.group(1))

def split_list(text):
    """«a, b (c, d), e x2.» → ['a', 'b (c, d)', 'e x2'] respetando paréntesis."""
    out, depth, cur = [], 0, ''
    for ch in text.strip().rstrip('.'):
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ',' and depth == 0: out.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur.strip())
    return out

def parse_item(text, unresolved, where):
    """«munición de fusil x40» / «ciberojo x2 (protección antideslumbrante x2)» / «escudo antibalas (10 PD)»."""
    m = re.match(r'^(.*?)(?:\s+x(\d+))?(?:\s*\((.*)\))?$', text.strip())
    name, qty, inner = m.group(1).strip(), int(m.group(2) or 1), m.group(3)
    uuid = resolve(name)
    if not uuid and inner and resolve(f'{name} ({inner})'): uuid, inner = resolve(f'{name} ({inner})'), None
    item = {'text': text.strip(), 'name': name, 'qty': qty, 'uuid': uuid}
    if not uuid: unresolved.append(f'{where}: {name}')
    if inner and not re.match(r'^\d+\s*PD$', inner):
        item['options'] = [parse_item(x, unresolved, where) for x in split_list(inner)]
    return item

def parse_block(lines, key, title, tier, unresolved):
    i = lines.index('Armas') + 1
    weapons, buf = [], []
    while not lines[i].strip().startswith('▶INT'):
        l = lines[i].strip()
        if re.fullmatch(r'\d+d6', l):
            name = ' '.join(buf).strip(); buf = []
            poor = name.endswith('de mala calidad')
            base = name.replace(' de mala calidad', '').strip()
            alias = ALIAS.get(norm(base), base)
            uuid = resolve(f'{alias} (mala calidad)') if poor else resolve(base)
            if not uuid: unresolved.append(f'{title} arma: {name}')
            weapons.append({'name': name, 'damage': l, 'uuid': uuid, 'poor': poor})
        elif l: buf.append(l)
        i += 1
    i = next(k for k in range(i, len(lines)) if lines[k].strip().startswith('▶Salv. muerte')) + 1
    vals = []
    while len(vals) < 3:
        if lines[i].strip(): vals.append(first_num(lines[i]))
        i += 1
    intv, will, hp = vals
    sk = ''
    while True:
        sk += ' ' + lines[i].strip(); i += 1
        if sk.strip().endswith('.'): break
    after = []
    while len(after) < 10:
        if lines[i].strip(): after.append(first_num(lines[i]))
        i += 1
    stats = {'int': intv, 'will': will, **{k: v for k, v in zip(AFTER, after) if k not in ('seriouslyWounded', 'deathSave')}}
    sw, ds = after[4], after[9]
    # Comprobaciones con las reglas de RED.
    if hp != 10 + 5 * math.ceil((will + stats['body']) / 2): die(f'{title}: PD {hp} no cuadra con VOL {will} y TCO {stats["body"]}')
    if sw != math.ceil(hp / 2): die(f'{title}: gravemente herido {sw} ≠ ⌈{hp}/2⌉')
    if ds != stats['body']: die(f'{title}: salvación {ds} ≠ TCO {stats["body"]}')
    skills, role = [], None
    for part in split_list(sk):
        m = re.match(r'^(.*?)\s+(\d+)(?:\s*\((\d+)\))?$', part) or die(f'{title}: habilidad ilegible {part!r}')
        label, base = m.group(1).strip(), int(m.group(2))
        if label in ROLE_ABILITY:
            role = {'ability': label, 'rank': base, 'key': ROLE_ABILITY[label][0], 'uuid': f'Compendium.cyberpunk-red-core.core_roles.Item.{ROLE_ABILITY[label][1]}'}
            continue
        plain = re.sub(r'\s*\(.*\)$', '', label)
        lab = {'Armas cuerpo a cuerpo': 'Arma cuerpo a cuerpo'}.get(plain, plain)
        entry = SKILLS.get(lab) or die(f'{title}: habilidad desconocida {label!r}')
        stat = stats[entry['stat']]
        level = base - stat
        if not -3 <= level <= 10: die(f'{title}: {label} base {base} − {entry["stat"]} {stat} = {level}')
        s = {'label': label, 'base': base, 'level': max(0, level)}
        # Base por debajo de la característica (penalizador no detallado, p. ej. Concentración del ciberpsicópata): nivel 0 y aviso.
        if level < 0: s['belowStat'] = level
        if label == 'Idioma (jerga callejera)' or label == 'Experto local (tu hogar)' or 'specialtyPack' not in entry and lab not in ('Idioma', 'Experto local'):
            s.update(red=entry.get('red'), redId=entry.get('redId'))
            if label == 'Idioma (jerga callejera)': s.update(red='Language (Streetslang)')
            if label == 'Experto local (tu hogar)': s.update(red='Local Expert (Your Home)')
        else:
            spec = re.search(r'\((.*)\)', label)
            pack = entry.get('specialtyPack') or ('core_skills-languages' if lab == 'Idioma' else 'core_skills-local-expert')
            s.update(specialtyPack=pack, specialty=spec.group(1) if spec else None)
            if label == 'Idioma (nativo)': s.update(native=True)
            else:
                u = resolve(f'{lab} ({spec.group(1)})') if spec else None
                s['uuid'] = u
                if not u: unresolved.append(f'{title} especialidad: {label}')
        skills.append(s)
    i = next(k for k in range(i, len(lines)) if lines[k].startswith('Blindaje:'))
    armor_name = lines[i].split(':', 1)[1].strip()
    head = int(re.match(r'(\d+)', lines[i + 2]).group(1)); body = int(re.match(r'(\d+)', lines[i + 4]).group(1))
    armor = {'name': armor_name, 'head': head, 'body': body, 'uuid': resolve(armor_name)}
    if norm(armor_name) not in ('subdérmico',):
        armor['headUuid'] = resolve(f'{ALIAS.get(norm(armor_name), norm(armor_name)).replace(" (cuerpo)", "")} (cabeza)') or resolve(norm(armor_name).replace('mediano', 'blindaje medio').replace('ligero', 'blindaje ligero') + ' (cabeza)')
    if not armor['uuid']: unresolved.append(f'{title} blindaje: {armor_name}')
    i = next(k for k in range(i, len(lines)) if lines[k].strip().startswith('▶Ciberequipo y equipo especial')) + 1
    eq = ''
    while True:
        eq += ' ' + lines[i].strip(); i += 1
        if eq.strip().endswith('.'): break
    gear = [parse_item(x, unresolved, title) for x in split_list(eq)]
    programs = []
    for k in range(i, min(i + 6, len(lines))):
        if lines[k].strip().startswith('▶Programas de ciberterminal'):
            for x in split_list(lines[k + 1]):
                u = resolve(x)
                if not u: unresolved.append(f'{title} programa: {x}')
                programs.append({'name': x, 'uuid': u})
    return {'key': key, 'name': title.capitalize() if title != 'NETRUNNER' else 'Netrunner', 'tier': tier, 'stats': stats, 'hp': hp, 'seriouslyWounded': sw, 'deathSave': ds,
            'role': role, 'skills': skills, 'weapons': weapons, 'armor': armor, 'gear': gear, 'programs': programs}

def npcs(unresolved):
    lines = page_lines(416, 420)
    starts = []
    for key, title, tier in NPCS:
        idx = [k for k, l in enumerate(lines) if l.strip() == title and lines[k + 1].strip() == 'Armas']
        if len(idx) != 1: die(f'{title}: {len(idx)} cabeceras')
        starts.append((idx[0], key, title, tier))
    starts.sort()
    out = []
    for n, (s, key, title, tier) in enumerate(starts):
        e = starts[n + 1][0] if n + 1 < len(starts) else len(lines)
        out.append(parse_block(lines[s:e], key, title, tier, unresolved))
    order = [k for k, _, _ in NPCS]
    return sorted(out, key=lambda x: order.index(x['key']))

# --- Encuentros -----------------------------------------------------------------------------------------------
TABLES = [('day', 'Encuentros diurnos en Night City'), ('dusk', 'Encuentros al anochecer en Night City'), ('midnight', 'Encuentros de medianoche en Night City')]
USA = {  # «Usa …» → ficha
    'guardaespaldas': 'bodyguard', 'pandilleros de carretera': 'roadGanger', 'pandillero de carretera': 'roadGanger', 'pandilleros': 'booster', 'pandillero': 'booster',
    'operativos de seguridad': 'securityOperative', 'operativo de seguridad': 'securityOperative', 'netrunner': 'netrunner', 'netrunners': 'netrunner',
    'jefe de recuperadores': 'reclaimerChief', 'jefe recuperador': 'reclaimerChief', 'jefes de recuperadores': 'reclaimerChief', 'oficial de seguridad': 'securityOfficer',
    'oficiales de seguridad': 'securityOfficer', 'piloto': 'outrider', 'pilotos': 'outrider', 'pirómano': 'pyro', 'pirómanos': 'pyro', 'ciberpsicópata': 'cyberpsycho',
}
def encounters():
    text = '\n'.join(doc[i - 1].get_text() for i in range(421, 430))
    text = re.sub(r'\n\d{3}\nCómo dirigir Cyberpunk\n', '\n', text)  # cabeceras de página
    out = []
    for n, (tid, title) in enumerate(TABLES):
        a = text.index(title) + len(title)
        b = text.index(TABLES[n + 1][1]) if n + 1 < len(TABLES) else len(text)
        body = text[a:b]
        # Rangos al principio de línea: «(1-5)», «(38–41)» (guion largo), «(95-00)» y «(25)», «(00)» (00 = 100).
        body = re.split(r'\nS\ncreamsheets', body)[0]  # tras la última tabla empieza «Screamsheets»
        parts = re.split(r'(?:^|\n)\s*\((\d+)(?:\s*[-–]\s*(\d+))?\)\s*', body)[1:]
        rows = []
        for k in range(0, len(parts), 3):
            lo = int(parts[k]) or 100
            hi = (int(parts[k + 1]) or 100) if parts[k + 1] is not None else lo
            raw = parts[k + 2]
            raw = re.sub(r'-\n(?=[a-záéíóúñ])', '', raw)  # palabras partidas a final de línea
            raw = re.sub(r'\s*\n\s*', ' ', raw).strip()
            # Restos de maquetación: el crédito de ilustración («POR NOMBRE APELLIDO») cierra la entrada y detrás puede
            # venir un recuadro lateral («… PÁGINA 308. DATOS»); se corta desde el crédito.
            raw = re.split(r'\s+POR [A-ZÁÉÍÓÚÑ]{2,}(?: [A-ZÁÉÍÓÚÑ]{2,})*(?:\s|$)', raw)[0].strip()
            m = re.match(r'^([^:]+):\s*(.*)$', raw) or die(f'{tid} {lo}-{hi}: sin título')
            entry_title, desc = m.group(1).strip(), m.group(2).strip()
            uses, external = [], []
            for u in re.finditer(r'\b[Uu]sa ([^;.)]+?)(?:[;.)]|$)', desc):
                name = norm(u.group(1))
                key = USA.get(name) or next((v for kk, v in USA.items() if name.startswith(kk)), None)
                if key: uses.append(key); continue
                # «Usa 6 oficiales de seguridad» / «Usa una cantidad de operativos … y 2 oficiales …»: nombres dentro de la frase.
                rest, found = name, []
                for kk in sorted(USA, key=len, reverse=True):
                    if re.search(r'\b' + re.escape(kk) + r'\b', rest):
                        found.append(USA[kk]); rest = re.sub(r'\b' + re.escape(kk) + r'\b', ' ', rest)
                # Referencias fuera de las 10 fichas (torreta automatizada, Trauma Team…): quedan como texto para el DJ.
                if found: uses.extend(found)
                else: external.append(u.group(1).strip())
            row = {'min': lo, 'max': hi, 'title': entry_title, 'text': desc, 'uses': list(dict.fromkeys(uses))}
            if external: row['external'] = external
            rows.append(row)
        cover = sorted(x for r in rows for x in range(r['min'], r['max'] + 1))
        if cover != list(range(1, 101)): die(f'{tid}: rangos no cubren 1–100: faltan {sorted(set(range(1, 101)) - set(cover))}, repetidos {[x for x in set(cover) if cover.count(x) > 1]}')
        out.append({'id': tid, 'title': title, 'die': '1d100', 'rows': rows})
    return out

CONTROL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')

def main():
    unresolved = []
    data = {'source': {'pdf': 'documentos/Ciberpunk RED - Libro básico.pdf', 'pages': 'PDF 416–429 (impresas 412–425)', 'sha256': sha(PDF)}, 'npcs': npcs(unresolved)}
    enc = encounters()
    for blob in (json.dumps(data, ensure_ascii=False), json.dumps(enc, ensure_ascii=False)):
        if CONTROL.search(json.loads(blob) and blob): die('carácter de control en los datos')
    if not all(r['uses'] or r.get('external') or not re.search(r'\b[Uu]sa ', r['text']) for t in enc for r in t['rows']): die('entrada con «Usa» sin ficha')
    if any(re.search(r'\bPOR [A-ZÁÉÍÓÚÑ]{4,}|\bDATOS\b', r['text']) for t in enc for r in t['rows']): die('restos de maquetación en los encuentros')
    (OUT / 'npcs.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8', newline='\n')
    (OUT / 'encounters.json').write_text(json.dumps(enc, ensure_ascii=False, indent=1) + '\n', encoding='utf8', newline='\n')
    print(json.dumps({'npcs': len(data['npcs']), 'encounters': {t['id']: len(t['rows']) for t in enc}, 'unresolved': unresolved}, ensure_ascii=False, indent=1))

if __name__ == '__main__': main()
