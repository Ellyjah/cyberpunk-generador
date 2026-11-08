/**
 * PNJ (lógica pura): plan de una ficha del libro («Tipejos y reclutas», data/npcs.json), entrada de encuentro por tirada
 * y respuestas automáticas para el PNJ rápido por rol (método Rata callejera).
 */
import { lifepathSlots, slotTable, rowForTotal } from "./lifepath.js";
import { gearChoices, specialtyChoices } from "./streetrat.js";

export const TIERS = ["mook", "lieutenant", "miniboss", "boss"];
const isCyber = (uuid) => typeof uuid === "string" && uuid.includes(".core_cyberware.");

/**
 * Plan de una ficha del libro.
 * - Estadísticas tal cual (SUE «—» = 0); PD del libro.
 * - Habilidades: nivel = base − característica (calculado en el extractor); «Idioma (nativo)» usa el idioma elegido.
 * - Armas: las de ciberequipo (garras, lanzagranadas oculto…) no se crean aquí: vienen en el ciberequipo, instaladas.
 * - Blindaje: cuerpo y cabeza (si el blindaje es ciberequipo, como el subdérmico, ya viene en el ciberequipo).
 * - Equipo y ciberequipo: cantidades en unidades; las opciones de ciberequipo se instalan en su fundacional.
 */
export function npcPlan(npc, { languageUuid = null, languageText = "" } = {}) {
  const stats = Object.fromEntries(Object.entries(npc.stats).map(([k, v]) => [k, v ?? 0]));
  const skills = [];
  for (const s of npc.skills) {
    if (s.native) { if (languageUuid || languageText) skills.push({ label: s.label, uuid: languageUuid, text: languageText, level: s.level }); continue; }
    if (s.red) skills.push({ label: s.label, red: s.red, redId: s.redId, level: s.level });
    else if (s.uuid) skills.push({ label: s.label, uuid: s.uuid, level: s.level });
  }
  const items = [];
  for (const w of npc.weapons) if (w.uuid && !isCyber(w.uuid)) items.push({ uuid: w.uuid, qty: 1, name: w.name, equip: true });
  if (npc.armor?.uuid && !isCyber(npc.armor.uuid)) {
    items.push({ uuid: npc.armor.uuid, qty: 1, name: npc.armor.name, equip: true });
    if (npc.armor.headUuid && npc.armor.headUuid !== npc.armor.uuid) items.push({ uuid: npc.armor.headUuid, qty: 1, name: npc.armor.name, equip: true });
  }
  const cyber = [];
  for (const g of npc.gear) {
    if (!g.uuid) continue;
    if (isCyber(g.uuid)) cyber.push({ uuid: g.uuid, qty: g.qty, name: g.name, options: (g.options ?? []).filter((o) => o.uuid).map((o) => ({ uuid: o.uuid, qty: o.qty, name: o.name })) });
    else items.push({ uuid: g.uuid, qty: g.qty, name: g.name });
  }
  for (const p of npc.programs ?? []) if (p.uuid) items.push({ uuid: p.uuid, qty: 1, name: p.name });
  const unresolved = [...npc.weapons.filter((w) => !w.uuid).map((w) => w.name), ...npc.gear.filter((g) => !g.uuid).map((g) => g.text)];
  return { stats, hp: npc.hp, skills, role: npc.role ? { uuid: npc.role.uuid, rank: npc.role.rank } : null, items, cyber, unresolved,
    below: npc.skills.filter((s) => s.belowStat).map((s) => ({ label: s.label, base: s.base })) };
}

/** Entrada de una tabla de encuentros para un total de 1d100. */
export function encounterFor(table, total) {
  return table.rows.find((r) => total >= r.min && total <= r.max) ?? null;
}

/**
 * Respuestas automáticas de Rata callejera para un PNJ rápido: `roll(n)` devuelve un entero de 1 a n (tirada).
 * Elige fila de características, opciones de equipo, especialidades e idioma (de las listas dadas) y, si `lifepath`,
 * recorre la vida pasada tirando cada tabla y eligiendo las decisiones al azar.
 */
export function autoAnswers(role, sections, { roll, specialtyOptions = {}, languages = [], lifepath = false }) {
  const a = { "stats.row": { row: roll(10) - 1 } };
  for (const g of gearChoices(role)) a[g.key] = { row: roll(g.line.options.length) - 1 };
  for (const s of specialtyChoices(role.streetratSkills)) {
    const opts = specialtyOptions[s.pack] ?? [];
    if (opts.length) { const o = opts[roll(opts.length) - 1]; a[s.key] = { uuid: o.uuid, text: o.name }; }
  }
  if (languages.length) { const l = languages[roll(languages.length) - 1]; a["lang.origin"] = { uuid: l.uuid, text: l.name }; }
  if (!lifepath) return a;
  // Vida pasada: se rellena hueco a hueco porque los recuentos y las decisiones abren huecos nuevos.
  for (let guard = 0; guard < 200; guard++) {
    const slot = lifepathSlots(sections, role.lifepath, a).find((s) => a[s.key] === undefined);
    if (!slot) break;
    if (slot.kind === "count") a[slot.key] = { count: Math.max(0, roll(10) - 7) };
    else if (slot.kind === "choice") a[slot.key] = { value: slot.options[roll(slot.options.length) - 1].value };
    else {
      const t = slotTable(slot, sections, role.lifepath);
      a[slot.key] = { row: rowForTotal(t, roll(Number(t.die.slice(2)))) };
    }
  }
  return a;
}
