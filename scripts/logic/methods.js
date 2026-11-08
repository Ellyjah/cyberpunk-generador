/**
 * Métodos de creación (lógica pura): características, habilidades y plan para apply.js según el método.
 * Claves de respuesta de Edgerunner (además de las de streetrat.js):
 *   stats.<clave>       fila (0–9) tirada o elegida para esa característica (el Core: «tira 1d10 para cada
 *                       característica individualmente» en la tabla del rol)
 *   skill.<etiqueta>    { level } de cada una de las 20 habilidades del rol (sin respuesta = 2, el mínimo)
 */
import { gearChoices, specialtyChoices, missingStreetrat, chosenGear, streetratPlan } from "./streetrat.js";

export const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

/** Entrada del catálogo (skills.json) para una etiqueta de plantilla: «Ciencia (elige 1)» → «Ciencia». */
export function catalogEntry(label, catalog) {
  return catalog[label] ?? catalog[label.replace(/\s*\(.*\)$/, "").trim()];
}

/** Coste de una habilidad: nivel × 2 si es (x2), nivel × 1 si no (ejemplos del Core: Atletismo 4 → 4; Artes marciales 2 → 4). */
export function skillCost(label, level, catalog) {
  return level * (catalogEntry(label, catalog)?.x2 ? 2 : 1);
}

/** Estado del reparto de habilidades de Edgerunner. */
export function edgerunnerSkills(role, answers, catalog, rules) {
  const { points, min, max } = rules.skills;
  const rows = role.edgerunnerSkills.map((s) => {
    const level = answers[`skill.${s.label}`]?.level ?? min;
    return { ...s, level, x2: Boolean(catalogEntry(s.label, catalog)?.x2), cost: skillCost(s.label, level, catalog) };
  });
  const spent = rows.reduce((n, r) => n + r.cost, 0);
  const errors = [];
  if (spent > points) errors.push({ code: "overBudget", spent, points });
  for (const r of rows) if (r.level < min || r.level > max) errors.push({ code: "range", label: r.label, min, max });
  return { rows, spent, budget: points, remaining: points - spent, errors };
}

/** Características de Edgerunner: valor de cada característica según su fila. */
export function edgerunnerStats(role, answers) {
  const out = {};
  for (const k of STAT_KEYS) {
    const row = answers[`stats.${k}`]?.row;
    if (Number.isInteger(row)) out[k] = role.statTable[row][k];
  }
  return out;
}

/** Respuestas pendientes (sin vida pasada) para el método. */
export function missingFor(method, role, answers, catalog, rules) {
  if (method === "streetrat") return missingStreetrat(role, answers);
  if (method === "edgerunner") {
    const miss = STAT_KEYS.filter((k) => !Number.isInteger(answers[`stats.${k}`]?.row)).map((k) => `stats.${k}`);
    for (const s of specialtyChoices(role.edgerunnerSkills)) if (!answers[s.key]?.uuid) miss.push(s.key);
    if (!answers["lang.origin"]?.text) miss.push("lang.origin");
    for (const g of gearChoices(role)) if (!Number.isInteger(answers[g.key]?.row)) miss.push(g.key);
    if (edgerunnerSkills(role, answers, catalog, rules).errors.length) miss.push("skills.points");
    return miss;
  }
  return ["method.pending"];
}

/** Plan para apply.js según el método (misma forma que streetratPlan). */
export function planFor(method, role, answers, rules, catalog) {
  if (method === "streetrat") return streetratPlan(role, answers, rules);
  if (method === "edgerunner") {
    const skills = edgerunnerSkills(role, answers, catalog, rules).rows.map((s) => {
      const spec = s.specialtyPack ? answers[`spec.${s.label}`] : null;
      return spec ? { label: s.label, uuid: spec.uuid, text: spec.text, level: s.level } : { label: s.label, red: s.red, redId: s.redId, level: s.level };
    });
    const lang = answers["lang.origin"];
    skills.push({ label: "origin-language", uuid: lang.uuid ?? null, text: lang.text, level: rules.cultureLanguageLevel });
    const housing = role.key === "exec" ? rules.housing.exec : rules.housing.default;
    return { roleUuid: role.uuid, roleRank: rules.roleAbilityStart, stats: edgerunnerStats(role, answers), skills, ...chosenGear(role, answers), money: rules.extraMoney, housing };
  }
  throw new Error(`método sin plan: ${method}`);
}
