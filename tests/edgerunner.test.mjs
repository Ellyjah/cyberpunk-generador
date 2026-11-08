import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { skillCost, edgerunnerSkills, edgerunnerStats, missingFor, planFor, STAT_KEYS } from "../scripts/logic/methods.js";
import { gearChoices } from "../scripts/logic/streetrat.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const roles = load("roles.json"), catalog = load("skills.json"), rules = load("rules.json");
const role = (k) => roles.find((r) => r.key === k);

test("coste: nivel × 1, o × 2 en las habilidades (x2), como los ejemplos del Core", () => {
  assert.equal(skillCost("Atletismo", 4, catalog), 4);
  assert.equal(skillCost("Disparo automático", 6, catalog), 12);
  assert.equal(skillCost("Artes marciales (elige 1)", 2, catalog), 4);
  assert.equal(skillCost("Experto local (tu hogar)", 3, catalog), 3);
});

test("ejemplo de Jay (mercenario edgerunner) del Core: coste total 86", () => {
  // Tabla del ejemplo en «Habilidades del edgerunner» (el idioma de origen, a 4, es gratis y no está entre las 20).
  const levels = { "Atletismo": 4, "Concentración": 2, "Conversación": 2, "Cultura": 4, "Evasión": 6, "Experto local (tu hogar)": 4, "Idioma (jerga callejera)": 4,
    "Pelea": 6, "Percepción": 6, "Percepción humana": 4, "Persuasión": 4, "Primeros auxilios": 4, "Sigilo": 6, "Arma cuerpo a cuerpo": 6, "Armas cortas": 4,
    "Armas largas": 4, "Disparo automático": 2, "Interrogatorio": 4, "Resistir torturas/drogas": 4, "Tácticas": 4 };
  const answers = Object.fromEntries(Object.entries(levels).map(([k, v]) => [`skill.${k}`, { level: v }]));
  const st = edgerunnerSkills(role("solo"), answers, catalog, rules);
  assert.equal(st.rows.length, 20);
  assert.equal(st.spent, 86);
  assert.equal(st.remaining, 0);
  assert.equal(st.errors.length, 0);
  assert.equal(st.rows.find((r) => r.label === "Disparo automático").cost, 4);
});

test("reparto: mínimo 2 por defecto, exceso de presupuesto y fuera de rango", () => {
  const r = role("netrunner");
  const base = edgerunnerSkills(r, {}, catalog, rules);
  assert.ok(base.rows.every((x) => x.level === 2));
  assert.equal(base.errors.length, 0);
  const all6 = Object.fromEntries(r.edgerunnerSkills.map((s) => [`skill.${s.label}`, { level: 6 }]));
  assert.ok(edgerunnerSkills(r, all6, catalog, rules).errors.some((e) => e.code === "overBudget"));
  assert.ok(edgerunnerSkills(r, { "skill.Atletismo": { level: 7 } }, catalog, rules).errors.some((e) => e.code === "range"));
});

test("características por columna y plan completo de Edgerunner", () => {
  const r = role("tech");
  const answers = Object.fromEntries(STAT_KEYS.map((k, i) => [`stats.${k}`, { row: i }]));
  const stats = edgerunnerStats(r, answers);
  STAT_KEYS.forEach((k, i) => assert.equal(stats[k], r.statTable[i][k]));
  answers["lang.origin"] = { text: "Italiano" };
  answers["spec.Ciencia (elige 1)"] = { uuid: "Compendium.x.y.Item.z", text: "Ciencia (Física)" };
  for (const g of gearChoices(r)) answers[g.key] = { row: 0 };
  assert.deepEqual(missingFor("edgerunner", r, answers, catalog, rules), []);
  const plan = planFor("edgerunner", r, answers, rules, catalog);
  assert.equal(plan.skills.length, 21);
  assert.equal(plan.money, 500);
  assert.deepEqual(plan.stats, stats);
  assert.ok(missingFor("edgerunner", r, {}, catalog, rules).includes("stats.int"));
});
