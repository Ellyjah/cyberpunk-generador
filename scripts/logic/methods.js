/**
 * Métodos de creación (lógica pura): características, habilidades y plan para apply.js según el método.
 * Claves de respuesta de Edgerunner (además de las de streetrat.js):
 *   stats.<clave>       fila (0–9) tirada o elegida para esa característica (el Core: «tira 1d10 para cada
 *                       característica individualmente» en la tabla del rol)
 *   skill.<etiqueta>    { level } de cada una de las 20 habilidades del rol (sin respuesta = 2, el mínimo)
 * Paquete completo:
 *   stats.<clave>       { value } comprado (sin respuesta = 6, el «reparto inicial» del Core), entre 2 y 8
 *   skill.<nombre>      { level } de cualquiera de las 66 habilidades (nombre de skills.json); básicas mínimo 2, demás 0
 *   spec.<nombre>       especialidad elegida para Artes marciales, Ciencia o Tocar instrumento → { uuid, text }
 *   cart                { items: [{ uuid, name, packs, amount, price, fashion }] }  compra de la tienda
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

// ---------------------------------------------------------------------------------------------- Paquete completo

/** Características compradas y validación con los puntos del rango elegido. */
export function completeStats(answers, rules, points) {
  const { statMin, statMax } = rules.complete;
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, answers[`stats.${k}`]?.value ?? 6]));
  const spent = STAT_KEYS.reduce((n, k) => n + stats[k], 0);
  const errors = [];
  if (spent > points) errors.push({ code: "overBudget", spent, points });
  for (const k of STAT_KEYS) if (stats[k] < statMin || stats[k] > statMax) errors.push({ code: "range", key: k });
  return { stats, spent, budget: points, remaining: points - spent, errors };
}

/** Las 66 habilidades con su nivel (básicas mínimo 2), coste y validación. */
export function completeSkills(answers, catalog, rules) {
  const { points, max, basicMin } = rules.skills;
  const rows = Object.values(catalog).map((c) => {
    const min = c.basic ? basicMin : 0;
    const level = answers[`skill.${c.name}`]?.level ?? min;
    return { name: c.name, stat: c.stat, x2: c.x2, basic: Boolean(c.basic), min, max, level, cost: level * (c.x2 ? 2 : 1), red: c.red, redId: c.redId, specialtyPack: c.specialtyPack };
  });
  const spent = rows.reduce((n, r) => n + r.cost, 0);
  const errors = [];
  if (spent > points) errors.push({ code: "overBudget", spent, points });
  for (const r of rows) {
    if (r.level < r.min || r.level > r.max) errors.push({ code: "range", name: r.name });
    if (r.specialtyPack && r.level > 0 && !answers[`spec.${r.name}`]?.uuid) errors.push({ code: "specialty", name: r.name });
  }
  return { rows, spent, budget: points, remaining: points - spent, errors };
}

/**
 * Totales de la tienda: la moda (ropa y cibermoda) se paga primero de los 800 ed de moda y el exceso de los 2550 ed;
 * lo que sobra de los 2550 se conserva como dinero; lo que sobra de los 800 se pierde (Core).
 */
export function shopTotals(cart, rules) {
  const { money, fashionMoney } = rules.complete;
  const items = cart?.items ?? [];
  const fashion = items.filter((i) => i.fashion).reduce((n, i) => n + i.price * i.packs, 0);
  const main = items.filter((i) => !i.fashion).reduce((n, i) => n + i.price * i.packs, 0);
  const fashionUsed = Math.min(fashion, fashionMoney);
  const mainSpent = main + (fashion - fashionUsed);
  return { fashion, fashionUsed, fashionLeft: fashionMoney - fashionUsed, main, mainSpent, mainLeft: money - mainSpent, over: mainSpent > money, money, fashionMoney };
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
  if (method === "complete") {
    const miss = [];
    if (completeStats(answers, rules, rules.completePoints ?? 62).errors.length) miss.push("stats.points");
    if (!answers["lang.origin"]?.text) miss.push("lang.origin");
    const sk = completeSkills(answers, catalog, rules);
    if (sk.errors.some((e) => e.code !== "specialty")) miss.push("skills.points");
    for (const e of sk.errors.filter((x) => x.code === "specialty")) miss.push(`spec.${e.name}`);
    if (shopTotals(answers.cart, rules).over) miss.push("shop.over");
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
  if (method === "complete") {
    const skills = [];
    for (const r of completeSkills(answers, catalog, rules).rows) {
      if (r.specialtyPack) {
        const spec = answers[`spec.${r.name}`];
        if (r.level > 0 && spec) skills.push({ label: r.name, uuid: spec.uuid, text: spec.text, level: r.level });
      } else if (r.level > 0 || r.basic) skills.push({ label: r.name, red: r.red, redId: r.redId, level: r.level });
    }
    const lang = answers["lang.origin"];
    skills.push({ label: "origin-language", uuid: lang.uuid ?? null, text: lang.text, level: rules.cultureLanguageLevel });
    const housing = role.key === "exec" ? rules.housing.exec : rules.housing.default;
    // La cantidad de cada Item es en unidades (como en las listas del libro): cajas × unidades por caja.
    const items = (answers.cart?.items ?? []).map((i) => ({ uuid: i.uuid, qty: i.packs * (i.amount || 1), name: i.name, cat: "shop" }));
    const totals = shopTotals(answers.cart, rules);
    return { roleUuid: role.uuid, roleRank: rules.roleAbilityStart, stats: completeStats(answers, rules, rules.completePoints ?? 62).stats, skills, items, clothing: [], money: totals.mainLeft, housing };
  }
  throw new Error(`método sin plan: ${method}`);
}
