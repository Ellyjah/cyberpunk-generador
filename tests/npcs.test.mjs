import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { npcPlan, encounterFor, autoAnswers, TIERS } from "../scripts/logic/npcs.js";
import { lifepathSlots, missingSlots } from "../scripts/logic/lifepath.js";
import { missingStreetrat } from "../scripts/logic/streetrat.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const { npcs } = load("npcs.json"), encounters = load("encounters.json"), roles = load("roles.json"), sections = load("lifepath.json");
const npc = (k) => npcs.find((n) => n.key === k);

test("10 fichas con nivel de amenaza y PD/Gravemente herido/Salvación coherentes con las reglas de RED", () => {
  assert.equal(npcs.length, 10);
  for (const n of npcs) {
    assert.ok(TIERS.includes(n.tier), n.key);
    assert.equal(n.hp, 10 + 5 * Math.ceil((n.stats.will + n.stats.body) / 2), n.key);
    assert.equal(n.seriouslyWounded, Math.ceil(n.hp / 2), n.key);
    assert.equal(n.deathSave, n.stats.body, n.key);
  }
  assert.deepEqual(npcs.filter((n) => n.role).map((n) => `${n.key}:${n.role.ability}:${n.role.rank}`), ["netrunner:Interface:4", "outrider:Motor:4", "pyro:Conciencia de combate:4"]);
});

test("plan del guardaespaldas: niveles, armas, blindaje y equipo", () => {
  const p = npcPlan(npc("bodyguard"), { languageText: "Español" });
  assert.equal(p.stats.luck, 0);
  assert.equal(p.skills.find((s) => s.red === "Handgun").level, 4); // base 10 − REF 6
  assert.equal(p.skills.find((s) => s.red === "Brawling").level, 6); // base 11 − DES 5
  assert.ok(p.skills.some((s) => s.text === "Español" && s.level === 2));
  assert.equal(p.items.filter((i) => i.equip).length, 4); // 2 armas + Kevlar cuerpo y cabeza
  assert.equal(p.items.find((i) => /escopeta/i.test(i.name) && !i.equip).qty, 25);
  assert.deepEqual(p.unresolved, []);
});

test("ciberpsicópata: las ciberarmas no se duplican y van instaladas en sus ciberbrazos; Concentración y Persuasión por debajo de su característica", () => {
  const p = npcPlan(npc("cyberpsycho"));
  assert.equal(p.items.filter((i) => i.equip).length, 0); // todas sus armas son ciberequipo; el blindaje es subdérmico
  const arms = p.cyber.find((c) => /ciberbrazo/i.test(c.name));
  assert.equal(arms.qty, 2);
  assert.ok(arms.options.some((o) => /lanzagranadas/i.test(o.name) && o.qty === 2));
  assert.deepEqual(p.below.map((b) => b.label), ["Concentración", "Persuasión"]); // bases del libro por debajo de VOL 7 y FRI 8
});

test("encuentros: tres tablas de 1d100 completas y cada «Usa» con su ficha", () => {
  assert.deepEqual(encounters.map((t) => t.id), ["day", "dusk", "midnight"]);
  for (const t of encounters) {
    for (let n = 1; n <= 100; n++) assert.ok(encounterFor(t, n), `${t.id} ${n}`);
    for (const r of t.rows) for (const u of r.uses) assert.ok(npc(u), `${t.id} ${r.min}: ${u}`);
  }
  assert.equal(encounterFor(encounters[2], 100).title, "Furia ciberpsicópata");
  assert.deepEqual(encounterFor(encounters[2], 100).uses, ["cyberpsycho"]);
});

test("PNJ rápido por rol: respuestas automáticas completas, con y sin vida pasada", () => {
  let seed = 7;
  const roll = (n) => { seed = (seed * 9301 + 49297) % 233280; return 1 + Math.floor((seed / 233280) * n); };
  const langs = [{ uuid: "Compendium.x.l.Item.1", name: "Idioma (Español)" }];
  const spec = { "core_skills-science": [{ uuid: "Compendium.x.s.Item.1", name: "Ciencia (Química)" }], "core_skills-play-instrument": [{ uuid: "Compendium.x.p.Item.1", name: "Tocar instrumento (Guitarra)" }] };
  for (const r of roles) {
    const a = autoAnswers(r, sections, { roll, languages: langs, specialtyOptions: spec, lifepath: true });
    assert.deepEqual(missingStreetrat(r, a), [], r.key);
    assert.deepEqual(missingSlots(lifepathSlots(sections, r.lifepath, a), a), [], r.key);
    const b = autoAnswers(r, sections, { roll, languages: langs, specialtyOptions: spec });
    assert.equal(Object.keys(b).some((k) => k.startsWith("g.")), false);
  }
});
