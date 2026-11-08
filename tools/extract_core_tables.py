"""Extrae del Core RED en español (journals sellados) las tablas de creación de PJ y genera data/*.json.
Claude Code, paso 2 del generador. Reproducible: python -I tools/extract_core_tables.py (desde la raíz del módulo).

Fuente: 02-edgerunners-world/staging/P02A21-audit-fixes-101/cyberpunk-red-core-esp/source/journals.json (Core 1.0.2).
Las habilidades se resuelven contra el volcado de compendios de RED v0.92.4 de 05-cyberpunk-tr-esp-work.
Cada tabla de tirada se valida: rangos completos de 1 al dado, sin huecos ni solapes. Cualquier
discrepancia detiene el script (no se escribe nada a medias)."""
import hashlib, json, re, html, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # .../cyberpunk
SRC = ROOT / '02-edgerunners-world/staging/P02A21-audit-fixes-101/cyberpunk-red-core-esp/source/journals.json'
DUMP = ROOT / '05-cyberpunk-tr-esp-work/source/red-core-dump.json'
OUT = Path(__file__).resolve().parents[1] / 'data'

journals = json.loads(SRC.read_text(encoding='utf8'))
PAGES = {p['_id']: p for j in journals['journals'] for p in j['pages']}
dump = json.loads(DUMP.read_text(encoding='utf8'))['packs']
RED_SKILLS = {d['name']: d for d in dump['internal_skills']['docs']}
RED_ITEMS = {f"{pack}.{d['_id']}": d for pack, v in dump.items() for d in v.get('docs', [])}

# --- Roles: clave interna, Item nativo (core_roles), páginas del Core --------------------------------------
ROLES = [  # key, itemId, nombre del Core, vida pasada de rol
    ('fixer', 'fR6KBqJgywWfhI2n', 'Arreglador', '023d29a8e7846b7e'),
    ('exec', 'MauQVKqh2mLLWXA8', 'Ejecutivo', '9ff75382798a0f87'),
    ('solo', 'I4qtphsiVa4rj9U8', 'Mercenario', '0a20fca66cd568e0'),
    ('netrunner', 'g5S5E8UG1QJ4yFsp', 'Netrunner', 'd4496efab4256ca0'),
    ('nomad', 'E2NkaEAx8Rv4nqWQ', 'Nómada', 'f4e6a00e0cfb5c44'),
    ('media', 'Ek251OMdphcqzWPP', 'Periodista', 'e2d10488d1188780'),
    ('lawman', 'kDE2jnvcsbbz1vaL', 'Policía', 'e46fea883008cb71'),
    ('rockerboy', 'ybQOwW3ICzHY7LiQ', 'Rockero', '73488c40b5578053'),
    ('tech', 'f815HiiDpThbd7eY', 'Técnico', 'a6a116775f0ea0ce'),
    ('medtech', '8wRoRsRQnpt3Je00', 'Tecnomédico', '758d3573aae7fb23'),
]
P_STATS, P_SR_SKILLS, P_ER_SKILLS = 'c7d392fb3b0523db', 'fe24adb1816ab8f4', 'c5d25d1e04982fcc'
P_WEAPONS, P_GEAR, P_CYBER, P_SKILL_LIST = '4a25d7645c5fd196', '7153fd1d59d36712', '32e92d6a0b5a4148', '1002f3699444b7ba'
P_LIFEPATH = ['556dabf81b249488', '994c0f60ff144b8f', '03f931e03bee71f4', '97c0e8973496e0a1']
STATS = ['int', 'ref', 'dex', 'tech', 'cool', 'will', 'luck', 'move', 'body', 'emp']  # claves de RED, orden del Core
STAT_ES = ['INT', 'REF', 'DES', 'TEC', 'FRI', 'VOL', 'SUE', 'MOV', 'TCO', 'EMP']

# --- Habilidades: nombre del Core → nombre interno de RED ------------------------------------------------
SKILL_EN = {
    'Burocracia': 'Bureaucracy', 'Buscar en bibliotecas': 'Library Search', 'Composición': 'Composition', 'Contabilidad': 'Accounting',
    'Criminología': 'Criminology', 'Criptografía': 'Cryptography', 'Cultura': 'Education', 'Deducción': 'Deduction', 'Juego': 'Gamble',
    'Manejo de animales': 'Animal Handling', 'Negocios': 'Business', 'Tácticas': 'Tactics', 'Supervivencia': 'Wilderness Survival',
    'Armas cortas': 'Handgun', 'Armas largas': 'Shoulder Arms', 'Armas pesadas': 'Heavy Weapons', 'Disparo automático': 'Autofire', 'Tiro con arco': 'Archery',
    'Concentración': 'Concentration', 'Lectura de labios': 'Lip Reading', 'Ocultar/Revelar objeto': 'Conceal/Reveal Object', 'Percepción': 'Perception', 'Rastrear': 'Tracking',
    'Conducir vehículo terrestre': 'Drive Land Vehicle', 'Montar': 'Riding', 'Pilotar vehículo acuático': 'Pilot Sea Vehicle', 'Pilotar vehículo aéreo': 'Pilot Air Vehicle',
    'Atletismo': 'Athletics', 'Baile': 'Dance', 'Contorsionismo': 'Contortionist', 'Resistencia': 'Endurance', 'Resistir torturas/drogas': 'Resist Torture/Drugs', 'Sigilo': 'Stealth',
    'Actuar': 'Acting', 'Arma cuerpo a cuerpo': 'Melee Weapon', 'Evasión': 'Evasion', 'Pelea': 'Brawling',
    'Arreglo personal': 'Personal Grooming', 'Comerciar': 'Trading', 'Conocimiento de la calle': 'Streetwise', 'Conversación': 'Conversation', 'Interrogatorio': 'Interrogation',
    'Percepción humana': 'Human Perception', 'Persuasión': 'Persuasion', 'Sobornar': 'Bribery', 'Vestuario y estilo': 'Wardrobe & Style',
    'Abrir cerraduras': 'Pick Lock', 'Cibertecnología': 'Cybertech', 'Demoliciones': 'Demolitions', 'Electrónica/Seguridad': 'Electronics/Security Tech', 'Enfermería': 'Paramedic',
    'Falsificación': 'Forgery', 'Fotografía/Filmación': 'Photography/Film', 'Mecánica básica': 'Basic Tech', 'Mecánica de armas': 'Weaponstech',
    'Mecánica de vehículos acuáticos': 'Sea Vehicle Tech', 'Mecánica de vehículos aéreos': 'Air Vehicle Tech', 'Mecánica de vehículos terrestres': 'Land Vehicle Tech',
    'Pintar/Dibujar/Esculpir': 'Paint/Draw/Sculpt', 'Primeros auxilios': 'First Aid', 'Robar bolsillos': 'Pick Pocket',
    'Experto local': 'Local Expert (Your Home)', 'Idioma': 'Language (Streetslang)',
}
# Habilidades con especialidad: el jugador elige la especialidad (compendio de RED indicado).
SPECIALTY_PACK = {'Artes marciales': 'core_skills-martial-arts', 'Ciencia': 'core_skills-science', 'Tocar instrumento': 'core_skills-play-instrument'}
FIXED_SPECIALTY = {'Experto local (tu hogar)': 'Local Expert (Your Home)', 'Idioma (jerga callejera)': 'Language (Streetslang)'}

def die(msg): sys.exit('ERROR: ' + msg)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def plain(s):
    s = re.sub(r'@UUID\[[^\]]+\]\{([^}]*)\}', r'\1', s)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

class Flow(HTMLParser):
    """Secuencia de bloques: ('h', nivel, texto), ('p', texto) y ('table', filas[celdas HTML])."""
    def __init__(s):
        super().__init__(convert_charrefs=False); s.blocks = []; s.stack = []; s.table = None; s.row = None; s.cell = None; s.text = None; s.tag = None
    def raw(s, x):
        if s.cell is not None: s.cell += x
        elif s.text is not None: s.text += x
    def handle_starttag(s, t, a):
        if t == 'table': s.table = []
        elif t == 'tr' and s.table is not None: s.row = []
        elif t in ('td', 'th') and s.row is not None: s.cell = ''
        elif s.cell is not None: s.raw(s.get_starttag_text())
        elif t in ('h1', 'h2', 'h3', 'h4', 'p', 'li'): s.text = ''; s.tag = t
    def handle_endtag(s, t):
        if t in ('td', 'th') and s.cell is not None: s.row.append(s.cell); s.cell = None
        elif t == 'tr' and s.row is not None: s.table.append(s.row); s.row = None
        elif t == 'table' and s.table is not None: s.blocks.append(('table', s.table)); s.table = None
        elif s.cell is not None: s.raw(f'</{t}>')
        elif s.text is not None and t == s.tag:
            txt = plain(s.text)
            if txt: s.blocks.append(('h', int(t[1]), txt) if t[0] == 'h' else ('p', txt))
            s.text = None
    def handle_data(s, x): s.raw(x)
    def handle_entityref(s, n): s.raw(f'&{n};')
    def handle_charref(s, n): s.raw(f'&#{n};')

def flow(pid):
    f = Flow(); f.feed(PAGES[pid]['text']['content']); return f.blocks

def tables_with_context(pid):
    """Cada tabla con su último encabezado y la última instrucción «Tira XdY» desde ese encabezado."""
    out, head, instr = [], None, None
    for b in flow(pid):
        if b[0] == 'h': head, instr = b[2], None
        elif b[0] == 'p' and re.search(r'\bTira\b|\bElige\b', b[1]): instr = b[1]
        elif b[0] == 'table': out.append({'heading': head, 'instruction': instr, 'rows': b[1]})
    return out

def parse_range(s):
    m = re.fullmatch(r'(\d+)(?:\s*[-–]\s*(\d+))?', s.strip())
    if not m: return None
    a = int(m.group(1)); return a, int(m.group(2) or a)

def roll_table(t, where, die_size=None):
    """Tabla con primera columna «Tirada»; devuelve {die, columns, rows:[{min,max,cells}]} validada."""
    header = [plain(c) for c in t['rows'][0]]
    if header[0] != 'Tirada': die(f'{where}: la primera columna no es Tirada: {header}')
    rows = []
    for r in t['rows'][1:]:
        rg = parse_range(plain(r[0]))
        if not rg: die(f'{where}: rango ilegible {plain(r[0])!r}')
        rows.append({'min': rg[0], 'max': rg[1], 'cells': [plain(c) for c in r[1:]]})
    m = re.search(r'1d(\d+)', t['instruction'] or '')
    size = die_size or (int(m.group(1)) if m else None)
    if not size: die(f'{where}: sin dado en la instrucción {t["instruction"]!r}')
    cover = [n for r in rows for n in range(r['min'], r['max'] + 1)]
    if sorted(cover) != list(range(1, size + 1)): die(f'{where}: rangos {cover} no cubren 1–{size}')
    return {'die': f'1d{size}', 'columns': header[1:], 'rows': rows}

# --- Habilidades -------------------------------------------------------------------------------------------
def skill_catalog():
    cat = {}
    for b in flow(P_SKILL_LIST):
        if b[0] == 'p' and False: pass
    content = PAGES[P_SKILL_LIST]['text']['content']
    for m in re.finditer(r'\{([^}<]+?)\s+(INT|REF|DES|TEC|FRI|VOL|EMP|MOV|TCO|SUE)\}', content):
        name, stat = m.group(1).strip(), STATS[STAT_ES.index(m.group(2))]
        x2 = name.endswith('(x2)'); base = name.replace('(x2)', '').strip()
        entry = {'name': base, 'stat': stat, 'x2': x2}
        if base in SPECIALTY_PACK: entry['specialtyPack'] = SPECIALTY_PACK[base]
        else:
            en = SKILL_EN.get(base) or die(f'habilidad sin correspondencia: {base}')
            red = RED_SKILLS.get(en) or die(f'habilidad de RED inexistente: {en}')
            if red['system']['stat'] != stat: die(f'{base}: característica {stat} ≠ RED {red["system"]["stat"]}')
            if (red['system']['difficulty'] == 'difficult') != x2: die(f'{base}: x2 no coincide con RED')
            entry.update(red=en, redId=red['_id'], basic=red['system']['basic'])
        cat[base] = entry
    if len(cat) != 66: die(f'lista de habilidades: {len(cat)} ≠ 66')
    return cat

def resolve_skill(label, cat, where):
    """«Experto local (tu hogar)», «Artes marciales (x2)», «Ciencia (elige una)»… → referencia de habilidad."""
    lab = re.sub(r'\s*\(x2\)', '', label).strip()
    if lab in FIXED_SPECIALTY: return {'label': lab, 'red': FIXED_SPECIALTY[lab], 'redId': RED_SKILLS[FIXED_SPECIALTY[lab]]['_id']}
    base = re.sub(r'\s*\(.*\)$', '', lab).strip()
    e = cat.get(lab) or cat.get(base) or die(f'{where}: habilidad desconocida {label!r}')
    ref = {'label': lab}
    if 'red' in e: ref['red'] = e['red']; ref['redId'] = e['redId']
    if 'specialtyPack' in e: ref['specialtyPack'] = e['specialtyPack']
    return ref

def by_heading(tables, prefix=''):
    out = {}
    for t in tables:
        for key, _, name, _ in ROLES:
            # Solo la primera tabla tras el encabezado: las siguientes son ejemplos (Jay) sin encabezado propio.
            if t['heading'] in (prefix + name.lower(), prefix + name, name) and key not in out: out[key] = t
    return out

# --- Equipo: cada <p> de la celda es una línea; « o » separa opciones --------------------------------------
UUID = r'@UUID\[Compendium\.cyberpunk-red-core\.([\w-]+)\.Item\.(\w+)\]\{([^}]*)\}'
def gear_lines(cell_html, where):
    lines = []
    for p in re.findall(r'<p>(.*?)</p>', cell_html, flags=re.S):
        txt = html.unescape(p)
        if not re.search(UUID, txt):
            lines.append(parse_clothing(plain(txt), where)); continue
        prefix = re.match(r'^([^@]*?)\s*(?=@UUID)', txt).group(1).strip()
        opts = []
        for part in re.split(r'\s+o\s+(?=@UUID)', txt[txt.index('@UUID'):]):
            m = re.match(UUID + r'\s*(.*)$', part.strip()) or die(f'{where}: opción ilegible {part!r}')
            pack, iid, name, rest = m.groups()
            key = f'{pack}.{iid}'
            if key not in RED_ITEMS: die(f'{where}: Item nativo inexistente {key} ({name})')
            q = re.match(r'x(\d+)\s*(.*)$', rest.strip())
            opts.append({'uuid': f'Compendium.cyberpunk-red-core.{pack}.Item.{iid}', 'name': name, 'qty': int(q.group(1)) if q else 1, 'note': (q.group(2) if q else rest).strip()})
        line = {'options': opts}
        if prefix: line['prefix'] = prefix.rstrip(':')
        lines.append(line)
    return lines

def parse_clothing(txt, where):
    """«Ropa de deporte: calzado x2, chaqueta x3» → {clothing:{style, items:[{type, qty}]}}."""
    m = re.match(r'^([^:]+):\s*(.+)$', txt) or die(f'{where}: línea sin enlace ni formato de ropa: {txt!r}')
    items = []
    for part in m.group(2).split(','):
        q = re.match(r'^(.*?)(?:\s+x(\d+))?$', part.strip())
        items.append({'type': q.group(1), 'qty': int(q.group(2) or 1)})
    return {'clothing': {'style': m.group(1).strip(), 'items': items}, 'text': txt}

def main():
    cat = skill_catalog()
    stats = tables_with_context(P_STATS)
    # Tablas por rol: las que siguen a un encabezado con el nombre del rol.
    stat_tables = by_heading(stats)
    sr = by_heading(tables_with_context(P_SR_SKILLS))
    er = by_heading(tables_with_context(P_ER_SKILLS), 'Habilidades de ')
    wp = by_heading(tables_with_context(P_WEAPONS), 'Armas/blindaje de ')
    gr = by_heading(tables_with_context(P_GEAR), 'Equipo de ')
    cy = by_heading(tables_with_context(P_CYBER), 'Ciberequipo de ')
    roles = []
    for key, iid, name, lp in ROLES:
        for label, d in (('características', stat_tables), ('habilidades rata', sr), ('habilidades edgerunner', er), ('armas', wp), ('equipo', gr), ('ciberequipo', cy)):
            if key not in d: die(f'{name}: falta la tabla de {label}')
        st = stat_tables[key]
        if [plain(c) for c in st['rows'][0]] != ['Tirada'] + STAT_ES: die(f'{name}: columnas de características')
        st_rows = []
        for i, r in enumerate(st['rows'][1:], 1):
            if plain(r[0]) != str(i): die(f'{name}: fila {i} de características')
            vals = [int(plain(c)) for c in r[1:]]
            if not all(2 <= v <= 8 for v in vals): die(f'{name}: característica fuera de 2–8')
            st_rows.append(dict(zip(STATS, vals)))
        if len(st_rows) != 10: die(f'{name}: {len(st_rows)} filas de características')
        srs = []
        for r in sr[key]['rows'][1:]:
            label, lvl = plain(r[0]), int(plain(r[1]))
            srs.append({**resolve_skill(label, cat, name), 'level': lvl})
        # Solo la tabla del tecnomédico trae fila de encabezado «Habilidad».
        ers = [resolve_skill(plain(r[0]), cat, name) for r in er[key]['rows'] if plain(r[0]) != 'Habilidad']
        if len(srs) != 20 or len(ers) != 20: die(f'{name}: {len(srs)}/{len(ers)} habilidades (se esperan 20)')
        # El mismo conjunto de 20 habilidades (en Nómada el Core cambia el orden de dos).
        if sorted(s['label'] for s in srs) != sorted(s['label'] for s in ers): die(f'{name}: las habilidades de rata y edgerunner no coinciden')
        # Dos filas: la lista de ciberequipo y la pérdida de Humanidad calculada por el libro.
        if len(cy[key]['rows']) != 2: die(f'{name}: tabla de ciberequipo con {len(cy[key]["rows"])} filas')
        cyber_cells = cy[key]['rows'][0]
        hl = re.search(r'Humanidad\s+(\d+)\s*\((-\d+)\s*EMP\)', plain(cy[key]['rows'][1][0])) or die(f'{name}: pérdida de Humanidad')
        roles.append({
            'key': key, 'name': name, 'itemId': iid, 'uuid': f'Compendium.cyberpunk-red-core.core_roles.Item.{iid}',
            'statTable': st_rows,
            'streetratSkills': srs, 'edgerunnerSkills': ers,
            'weapons': gear_lines(wp[key]['rows'][0][0], name + ' armas'),
            'gear': gear_lines(gr[key]['rows'][0][0], name + ' equipo'),
            'cyberware': gear_lines(cyber_cells[0], name + ' ciberequipo'),
            'cyberwareHumanityLoss': int(hl.group(1)), 'cyberwareEmpLoss': int(hl.group(2)),
            'lifepathPage': lp, 'lifepath': role_lifepath(key, lp),
        })
    general = general_lifepath()
    rules = {
        'source': {'journals': str(SRC.relative_to(ROOT)).replace('\\', '/'), 'sha256': sha(SRC), 'redDump': sha(DUMP)},
        'roleAbilityStart': 4, 'cultureLanguageLevel': 4,
        'skills': {'points': 86, 'min': 2, 'max': 6, 'basicMin': 2},
        'complete': {'statMin': 2, 'statMax': 8, 'statPoints': stat_ranks(stats), 'money': 2550, 'fashionMoney': 800},
        'extraMoney': 500,
        # «Estilo de vida y alojamiento» (página 7153fd1d59d36712): primer mes gratis; después 1.100 ed (no ejecutivo) o 600 ed (ejecutivo).
        'housing': {
            'default': {'housing': {'description': 'Contenedor de carga', 'cost': 1000}, 'lifestyle': {'description': 'Pienso', 'cost': 100}},
            'exec': {'housing': {'description': 'Cubículo en zona corporativa', 'cost': 0}, 'lifestyle': {'description': 'Precocinados de calidad', 'cost': 600}},
        },
    }
    OUT.mkdir(exist_ok=True)
    write('roles.json', roles); write('skills.json', cat); write('lifepath.json', general); write('rules.json', rules)
    print(json.dumps({'roles': len(roles), 'skills': len(cat), 'lifepathSections': len(general), 'roleLifepathNodes': sum(len(r['lifepath']) for r in roles)}))

def stat_ranks(stats):
    t = next(t for t in stats if plain(t['rows'][0][0]) == 'Rango de personaje')
    return [{'rank': plain(r[0]), 'points': int(plain(r[1]))} for r in t['rows'][1:]]

def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8', newline='\n')

# --- Vida pasada general ------------------------------------------------------------------------------------
# (página, índice de tabla) → sección; `fields` asigna cada columna a un campo de system.lifepath de RED.
# perColumn: cada columna se tira por separado (el libro: «tira … para cada columna»); sin él, una tirada da la fila entera.
# wronged: en los enemigos, «decide cuál fue la parte perjudicada» (elección, no tirada).
GENERAL = [
    ('culturalOrigin', '556dabf81b249488', 0, {'fields': ['culturalOrigin', None], 'languages': True}),
    ('personality', '556dabf81b249488', 1, {'fields': ['personality']}),
    ('style', '556dabf81b249488', 2, {'fields': ['clothingStyle', 'hairStyle'], 'perColumn': True}),
    ('affectations', '556dabf81b249488', 3, {'fields': ['affectations']}),
    ('motivations', '556dabf81b249488', 4, {'fields': ['valueMost', 'aboutPeople'], 'perColumn': True}),
    ('valuedPerson', '556dabf81b249488', 5, {'fields': ['valuedPerson']}),
    ('valuedPossession', '556dabf81b249488', 6, {'fields': ['valuedPossession']}),
    ('familyBackground', '994c0f60ff144b8f', 0, {'fields': ['familyBackground', 'familyBackground']}),
    ('childhoodEnvironment', '994c0f60ff144b8f', 1, {'fields': ['childhoodEnvironment']}),
    ('familyCrisis', '994c0f60ff144b8f', 2, {'fields': ['familyCrisis']}),
    ('friends', '03f931e03bee71f4', 0, {'fields': ['friends'], 'count': '1d10-7', 'title': 'Amigos'}),  # la tabla hereda el encabezado de página «Amigos y enemigos»
    ('enemies', '03f931e03bee71f4', 1, {'fields': ['enemies', 'enemies', 'enemies'], 'count': '1d10-7', 'perColumn': True, 'wronged': [{'value': 'you', 'label': 'Tú'}, {'value': 'them', 'label': 'Tu enemigo'}], 'then': 'revenge'}),
    ('revenge', '03f931e03bee71f4', 2, {'fields': ['enemies'], 'perEnemy': True}),
    ('tragicLoveAffairs', '97c0e8973496e0a1', 0, {'fields': ['tragicLoveAffairs'], 'count': '1d10-7'}),
    ('lifeGoals', '97c0e8973496e0a1', 1, {'fields': ['lifeGoals']}),
]
def general_lifepath():
    out = []
    for sid, pid, idx, opt in GENERAL:
        tabs = tables_with_context(pid)
        t = tabs[idx]
        # Las tablas de amigos/enemigos/amores tiran 1d10 por entrada aunque la instrucción hable del recuento.
        tab = roll_table(t, f'{sid}', 10 if sid in ('friends', 'enemies', 'tragicLoveAffairs') else None)
        if len(opt['fields']) != len(tab['columns']): die(f'{sid}: {len(tab["columns"])} columnas, {len(opt["fields"])} campos')
        sec = {'id': sid, 'title': t['heading'], 'instruction': t['instruction'], **tab, **opt}  # opt['title'] corrige el título si hace falta
        if opt.get('languages'):
            sec['languageOptions'] = [[x.strip(' .') for x in r['cells'][1].split(',')] for r in tab['rows']]
        out.append(sec)
    return out

# --- Vida pasada de rol: tablas en orden + decisiones y condiciones (del «Recorrido de las decisiones») -----
# choice: (insertar antes de la tabla n.º, id, título, [(valor, etiqueta)], condición opcional)
# when: {n.º de tabla: (id de decisión, valor requerido)}
PARTNER = [('partner', 'Socio'), ('solo', 'Solo')]
ROLE_FLOW = {
    'fixer': {'choices': [(1, 'partner', '¿Tienes un socio, o trabajas solo?', PARTNER, None)], 'when': {1: ('partner', 'partner')}},
    'netrunner': {'choices': [(1, 'partner', '¿Tienes un socio, o trabajas solo?', PARTNER, None)], 'when': {1: ('partner', 'partner')}},
    'tech': {'choices': [(1, 'partner', '¿Tienes un socio o trabajas solo?', PARTNER, None)], 'when': {1: ('partner', 'partner')}},
    'medtech': {'choices': [(1, 'partner', '¿Tienes un socio o trabajas solo?', PARTNER, None)], 'when': {1: ('partner', 'partner')}},
    'nomad': {'choices': [(1, 'base', '¿Tu tribu tiene su base en tierra, aire o mar?', [('land', 'Tierra'), ('air', 'Aire'), ('sea', 'Mar')], None)],
              'when': {1: ('base', 'land'), 2: ('base', 'air'), 3: ('base', 'sea')}},
    'rockerboy': {'choices': [(1, 'group', '¿Estás en un grupo o actúas en solitario?', [('group', 'En un grupo'), ('solo', 'En solitario')], None),
                              (1, 'wasInGroup', '¿Estuviste en un grupo?', [('yes', 'Sí'), ('no', 'No')], ('group', 'solo'))],
                  'when': {1: ('wasInGroup', 'yes')}},
}
EXPECTED_ROLE_TABLES = {'fixer': 5, 'exec': 6, 'solo': 4, 'netrunner': 6, 'nomad': 7, 'media': 4, 'lawman': 5, 'rockerboy': 4, 'tech': 6, 'medtech': 5}
def role_lifepath(key, pid):
    tabs = [t for t in tables_with_context(pid) if t['rows'] and plain(t['rows'][0][0]) == 'Tirada']
    if len(tabs) != EXPECTED_ROLE_TABLES[key]: die(f'vida pasada {key}: {len(tabs)} tablas ≠ {EXPECTED_ROLE_TABLES[key]}')
    cfg = ROLE_FLOW.get(key, {'choices': [], 'when': {}})
    nodes = []
    for i, t in enumerate(tabs):
        for at, cid, title, options, cond in cfg['choices']:
            if at == i:
                n = {'type': 'choice', 'id': cid, 'title': title, 'options': [{'value': v, 'label': l} for v, l in options]}
                if cond: n['when'] = {'id': cond[0], 'value': cond[1]}
                nodes.append(n)
        n = {'type': 'table', 'id': f't{i}', 'title': t['heading'], 'instruction': t['instruction'], **roll_table(t, f'vida pasada {key} tabla {i}')}
        if i in cfg['when']: n['when'] = {'id': cfg['when'][i][0], 'value': cfg['when'][i][1]}
        nodes.append(n)
    return nodes

if __name__ == '__main__': main()
