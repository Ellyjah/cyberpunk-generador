import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rowForTotal, countFromTotal, activeRoleNodes, lifepathSlots, missingSlots, lifepathFields } from "../scripts/logic/lifepath.js";
import { gearChoices, specialtyChoices, missingStreetrat, chosenGear, streetratPlan, CLOTHING_STYLE, CLOTHING_TYPE } from "../scripts/logic/streetrat.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const roles = load("roles.json"), sections = load("lifepath.json"), rules = load("rules.json");
const role = (k) => roles.find((r) => r.key === k);

test("filas por tirada y recuentos 1d10-7", () => {
  const revenge = sections.find((s) => s.id === "revenge");
  assert.equal(rowForTotal(revenge, 1), 0); assert.equal(rowForTotal(revenge, 2), 0); assert.equal(rowForTotal(revenge, 10), 5);
  assert.equal(countFromTotal("1d10-7", 5), 0); assert.equal(countFromTotal("1d10-7", 10), 3);
});

test("decisiones de rol: el socio solo aparece si se elige y el rockero solitario pregunta si estuvo en un grupo", () => {
  const net = role("netrunner").lifepath;
  assert.ok(!activeRoleNodes(net, {}).some((n) => n.id === "t1"));
  assert.ok(activeRoleNodes(net, { "r.partner": { value: "partner" } }).some((n) => n.id === "t1"));
  const rock = role("rockerboy").lifepath;
  assert.ok(!activeRoleNodes(rock, { "r.group": { value: "group" } }).some((n) => n.id === "wasInGroup"));
  const solo = activeRoleNodes(rock, { "r.group": { value: "solo" }, "r.wasInGroup": { value: "yes" } }).map((n) => n.id);
  assert.ok(solo.includes("wasInGroup") && solo.includes("t1"));
  const nomad = activeRoleNodes(role("nomad").lifepath, { "r.base": { value: "sea" } }).map((n) => n.id);
  assert.ok(nomad.includes("t3") && !nomad.includes("t1") && !nomad.includes("t2"));
});

test("huecos de vida pasada: por columna, recuentos con entradas, enemigo con perjudicado y venganza", () => {
  const nodes = role("fixer").lifepath;
  let slots = lifepathSlots(sections, nodes, {});
  const keys = slots.map((s) => s.key);
  assert.ok(keys.includes("g.style.c0") && keys.includes("g.style.c1") && !keys.includes("g.culturalOrigin.lang"));
  assert.ok(keys.includes("g.enemies.n") && !keys.includes("g.enemies.0.c0"));
  slots = lifepathSlots(sections, nodes, { "g.enemies.n": { count: 2 } });
  const k2 = slots.map((s) => s.key);
  for (const k of ["g.enemies.1.c0", "g.enemies.1.c2", "g.enemies.1.wronged", "g.revenge.1"]) assert.ok(k2.includes(k), k);
  assert.ok(missingSlots(slots, {}).length > 0);
});

test("texto de vida pasada para los campos de RED", () => {
  const nodes = role("fixer").lifepath;
  const a = { "g.culturalOrigin": { row: 2 }, "lang.origin": { text: "Italiano" }, "g.style.c0": { row: 0 }, "g.style.c1": { row: 4 },
    "g.friends.n": { count: 0 }, "g.enemies.n": { count: 1 }, "g.enemies.0.c0": { row: 0 }, "g.enemies.0.c1": { row: 1 }, "g.enemies.0.c2": { row: 2 },
    "g.enemies.0.wronged": { value: "you" }, "g.revenge.0": { row: 5 }, "r.t0": { row: 3 }, "r.partner": { value: "solo" } };
  const f = lifepathFields(sections, nodes, a);
  assert.match(f.culturalOrigin, /Europa occidental.*Italiano/);
  assert.match(f.clothingStyle, /Ropa normal elegante/); assert.match(f.hairStyle, /Calvo/);
  assert.match(f.friends, /Ninguno/);
  assert.match(f.enemies, /Antiguo amigo.*Tú.*Salir a matarle/s);
  assert.match(f.roleLifepath, /Solo/);
});

test("rata callejera: elecciones pendientes y plan", () => {
  const r = role("medtech");
  assert.deepEqual(specialtyChoices(r.streetratSkills).map((s) => s.label), ["Ciencia (elige 1)"]);
  assert.equal(gearChoices(r).length, 4); // arma, munición, munición incendiaria, ciberequipo
  const answers = { "stats.row": { row: 0 }, "spec.Ciencia (elige 1)": { uuid: "Compendium.x.y.Item.z", text: "Ciencia (Biología)" }, "lang.origin": { text: "Italiano" } };
  for (const g of gearChoices(r)) answers[g.key] = { row: 1 };
  assert.deepEqual(missingStreetrat(r, answers), []);
  const plan = streetratPlan(r, answers, rules);
  assert.equal(plan.stats.int, 7);
  assert.equal(plan.skills.length, 21);
  assert.ok(plan.items.some((i) => i.name === "Fusil de asalto"));
  assert.ok(plan.clothing.every((c) => Object.values(CLOTHING_STYLE).includes(c.style) && Object.values(CLOTHING_TYPE).includes(c.type)));
  assert.equal(plan.money, 500); assert.equal(plan.roleRank, 4);
});

test("toda la ropa del equipo inicial tiene correspondencia de estilo y tipo", () => {
  for (const r of roles) for (const c of chosenGear(r, {}).clothing) assert.ok(c.style && c.type, `${r.name}: ${c.text}`);
});
