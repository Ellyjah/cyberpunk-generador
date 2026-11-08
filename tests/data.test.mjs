// Integridad de data/*.json (generados por tools/extract_core_tables.py a partir del Core en español).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const roles = load("roles.json"), skills = load("skills.json"), lifepath = load("lifepath.json"), rules = load("rules.json");
const STATS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const BASIC = ["Atletismo", "Concentración", "Conversación", "Cultura", "Evasión", "Experto local (tu hogar)", "Idioma (jerga callejera)", "Pelea", "Percepción", "Percepción humana", "Persuasión", "Primeros auxilios", "Sigilo"];

function coversDie(rows, die) {
  const n = Number(die.slice(2));
  const hits = rows.flatMap((r) => Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i)).sort((a, b) => a - b);
  return JSON.stringify(hits) === JSON.stringify(Array.from({ length: n }, (_, i) => i + 1));
}

test("10 roles con Item nativo y claves únicas", () => {
  assert.equal(roles.length, 10);
  assert.equal(new Set(roles.map((r) => r.key)).size, 10);
  for (const r of roles) assert.match(r.uuid, /^Compendium\.cyberpunk-red-core\.core_roles\.Item\.\w{16}$/);
});

test("tablas de características: 10 filas × 10 características entre 2 y 8", () => {
  for (const r of roles) {
    assert.equal(r.statTable.length, 10, r.name);
    for (const row of r.statTable) {
      assert.deepEqual(Object.keys(row), STATS);
      assert.ok(Object.values(row).every((v) => v >= 2 && v <= 8), r.name);
    }
  }
});

test("habilidades de rata callejera: 20 por rol, básicas incluidas, niveles 2–6 y resueltas en RED", () => {
  for (const r of roles) {
    assert.equal(r.streetratSkills.length, 20, r.name);
    const labels = r.streetratSkills.map((s) => s.label);
    for (const b of BASIC) assert.ok(labels.includes(b), `${r.name}: falta ${b}`);
    for (const s of r.streetratSkills) {
      assert.ok(s.level >= 2 && s.level <= 6, `${r.name} ${s.label}`);
      assert.ok(s.red || s.specialtyPack, `${r.name} ${s.label} sin habilidad de RED`);
    }
    assert.deepEqual([...r.edgerunnerSkills.map((s) => s.label)].sort(), [...labels].sort(), r.name);
  }
});

test("equipo inicial: cada opción enlaza un Item nativo con cantidad", () => {
  for (const r of roles) for (const k of ["weapons", "gear", "cyberware"]) {
    assert.ok(r[k].length > 0, `${r.name} ${k}`);
    for (const line of r[k]) {
      if (line.clothing) { assert.ok(line.clothing.items.length > 0); continue; }
      for (const o of line.options) { assert.match(o.uuid, /^Compendium\.cyberpunk-red-core\.[\w-]+\.Item\.\w{16}$/); assert.ok(o.qty >= 1); }
    }
  }
  for (const r of roles) assert.ok(r.cyberware.every((l) => l.options?.every((o) => o.uuid.includes(".core_cyberware."))), r.name);
});

test("vida pasada: rangos completos y decisiones referenciadas", () => {
  assert.equal(lifepath.length, 15);
  for (const s of lifepath) assert.ok(coversDie(s.rows, s.die), s.id);
  for (const r of roles) {
    const choices = new Map(r.lifepath.filter((n) => n.type === "choice").map((n) => [n.id, n.options.map((o) => o.value)]));
    for (const n of r.lifepath) {
      if (n.type === "table") assert.ok(coversDie(n.rows, n.die), `${r.name} ${n.title}`);
      if (n.when) assert.ok(choices.get(n.when.id)?.includes(n.when.value), `${r.name} ${n.id}: condición sin decisión`);
    }
  }
});

test("catálogo de habilidades y reglas", () => {
  assert.equal(Object.keys(skills).length, 66);
  assert.equal(Object.values(skills).filter((s) => s.x2).length, 7);
  assert.equal(rules.skills.points, 86);
  assert.equal(rules.complete.money, 2550);
  assert.ok(rules.complete.statPoints.some((p) => p.points === 62));
});
