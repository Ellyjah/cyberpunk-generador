// Paquete completo: los tres ejemplos de Jay del Core (características 62, habilidades 86, compra 2550 ed) y validaciones.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { completeStats, completeSkills, shopTotals, missingFor, planFor, STAT_KEYS } from "../scripts/logic/methods.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const roles = load("roles.json"), catalog = load("skills.json"), rules = { ...load("rules.json"), completePoints: 62 };
const solo = roles.find((r) => r.key === "solo");

// «Reparto final del paquete completo» del Core.
const JAY_STATS = { int: 5, ref: 7, dex: 8, tech: 3, cool: 6, will: 7, luck: 6, move: 8, body: 8, emp: 4 };
// «Habilidades del paquete completo»: básicas a 2 y estas 13.
const JAY_SKILLS = { "Arma cuerpo a cuerpo": 5, "Armas cortas": 4, "Armas largas": 4, "Artes marciales": 2, "Conducir vehículo terrestre": 4, "Deducción": 4,
  "Disparo automático": 6, "Interrogatorio": 4, "Rastrear": 4, "Resistencia": 4, "Resistir torturas/drogas": 4, "Supervivencia": 4, "Tácticas": 3 };
// Compra de 2550 ed del Core con los precios y cajas de RED v0.92.4 (precio por caja, unidades por caja, cajas).
const JAY_CART = [["Conexión neuronal", 500, 1, 1], ["Cibervelocidad Sandevistan", 500, 1, 1], ["Fusil de asalto", 500, 1, 1], ["Subfusil pesado", 100, 1, 1],
  ["Arma cuerpo a cuerpo pesada", 100, 1, 1], ["Blindaje ligero (cuerpo)", 100, 1, 1], ["Blindaje ligero (cabeza)", 100, 1, 1], ["Munición básica de pistola pesada", 10, 10, 10],
  ["Munición básica de fusil", 10, 10, 10], ["Granada cegadora", 100, 1, 1], ["Granada de humo", 50, 1, 2], ["Binoculares", 50, 1, 1], ["Teléfono móvil desechable", 50, 1, 1],
  ["Tienda y material de acampada", 50, 1, 1], ["Bolsa de viaje", 20, 1, 1], ["Linterna", 20, 1, 1], ["Cama hinchable y saco de dormir", 20, 1, 1], ["Kit de higiene personal", 20, 1, 1], ["Cuerda", 20, 1, 1]]
  .map(([name, price, amount, packs], i) => ({ uuid: `Compendium.x.y.Item.${i}`, name, price, amount, packs, fashion: false }));
// Moda de Jay (380 ed): solo de los 800 de moda.
const JAY_FASHION = [["Parte de abajo de cuero nómada", 100], ["Parte de arriba de cuero nómada", 20], ["Chaqueta de cuero nómada", 100], ["Calzado de cuero nómada", 100], ["Gafas espejadas", 50], ["Hebras PEM", 10]]
  .map(([name, price], i) => ({ uuid: `Compendium.x.f.Item.${i}`, name, price, amount: 1, packs: 1, fashion: true }));

const jayAnswers = () => {
  const a = Object.fromEntries(STAT_KEYS.map((k) => [`stats.${k}`, { value: JAY_STATS[k] }]));
  for (const [k, v] of Object.entries(JAY_SKILLS)) a[`skill.${k}`] = { level: v };
  a["spec.Artes marciales"] = { uuid: "Compendium.x.m.Item.1", text: "Artes marciales (Judo)" };
  a["lang.origin"] = { text: "Español" };
  a.cart = { items: [...JAY_CART, ...JAY_FASHION] };
  return a;
};

test("características de Jay: 62 puntos exactos; por defecto todas a 6 (60)", () => {
  const st = completeStats(jayAnswers(), rules, 62);
  assert.equal(st.spent, 62); assert.equal(st.errors.length, 0);
  assert.equal(completeStats({}, rules, 62).spent, 60);
  assert.ok(completeStats({ "stats.int": { value: 9 } }, rules, 62).errors.some((e) => e.code === "range"));
  assert.ok(completeStats({ "stats.int": { value: 8 }, "stats.ref": { value: 8 }, "stats.dex": { value: 8 } }, rules, 62).errors.some((e) => e.code === "overBudget"));
});

test("habilidades de Jay: 86 puntos exactos (básicas 13 × 2 + 60)", () => {
  const sk = completeSkills(jayAnswers(), catalog, rules);
  assert.equal(sk.rows.length, 66);
  assert.equal(sk.rows.filter((r) => r.basic).length, 13);
  assert.equal(sk.spent, 86); assert.equal(sk.errors.length, 0);
  assert.equal(completeSkills({}, catalog, rules).spent, 26);
  assert.ok(completeSkills({ "skill.Ciencia": { level: 2 } }, catalog, rules).errors.some((e) => e.code === "specialty"));
  assert.ok(completeSkills({ "skill.Atletismo": { level: 1 } }, catalog, rules).errors.some((e) => e.code === "range"));
});

test("compra de Jay: 2550 ed exactos y la moda (380) sale de los 800", () => {
  const t = shopTotals({ items: [...JAY_CART, ...JAY_FASHION] }, rules);
  assert.equal(t.main, 2550); assert.equal(t.mainLeft, 0); assert.equal(t.over, false);
  assert.equal(t.fashion, 380); assert.equal(t.fashionLeft, 420);
  const extra = shopTotals({ items: [...JAY_FASHION, { price: 500, packs: 1, fashion: true }] }, rules);
  assert.equal(extra.fashionUsed, 800); assert.equal(extra.mainSpent, 80); // el exceso de moda sale de los 2550
  assert.equal(shopTotals({ items: [...JAY_CART, { price: 1, packs: 1, fashion: false }] }, rules).over, true);
});

test("plan del Paquete completo de Jay", () => {
  const a = jayAnswers();
  assert.deepEqual(missingFor("complete", solo, a, catalog, rules), []);
  const plan = planFor("complete", solo, a, rules, catalog);
  assert.deepEqual(plan.stats, JAY_STATS);
  assert.equal(plan.money, 0); // sin los 500 ed extra de Rata callejera/Edgerunner
  assert.equal(plan.items.find((i) => i.name === "Munición básica de fusil").qty, 100); // 10 cajas × 10
  assert.ok(plan.skills.some((s) => s.text === "Artes marciales (Judo)" && s.level === 2));
  assert.ok(plan.skills.some((s) => s.red === "Autofire" && s.level === 6));
  assert.equal(plan.skills.filter((s) => s.red && s.level === 2).length >= 13, true);
  assert.ok(missingFor("complete", solo, { ...a, cart: { items: [...JAY_CART, { price: 5, packs: 1, fashion: false }] } }, catalog, rules).includes("shop.over"));
});
