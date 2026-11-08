"""Cotejo independiente: las 100 filas de data/roles.json (statTable) aparecen en el PDF del libro básico.
Uso (desde la raíz del módulo): python -I -W ignore tools/check_pdf_stats.py. Requiere pymupdf. Claude Code, paso 2."""
import json, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT.parent / 'documentos/Ciberpunk RED - Libro básico.pdf'
roles = json.loads((ROOT / 'data/roles.json').read_text(encoding='utf8'))
doc = pymupdf.open(str(PDF))
text = {i + 1: ' '.join(re.findall(r'\d+', doc[i].get_text())) for i in range(70, 90)}  # PDF 78–81
missing = []
for r in roles:
    for n, row in enumerate(r['statTable'], 1):
        seq = f"{n} " + ' '.join(str(v) for v in row.values())
        if not any(seq in t for t in text.values()): missing.append((r['name'], n))
print(json.dumps({'rows': sum(len(r['statTable']) for r in roles), 'missing': missing}, ensure_ascii=False))
sys.exit(1 if missing else 0)
