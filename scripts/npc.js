/**
 * PNJ (solo DJ). Menú del botón del directorio y tres formas de crear PNJ:
 *  - ficha del libro («Tipejos y reclutas», data/npcs.json);
 *  - encuentro aleatorio (tablas de Night City, data/encounters.json): tirada 1d100 solo para el DJ y creación de las fichas
 *    que cita la entrada, con el texto de la entrada (variaciones incluidas) en las notas de cada PNJ;
 *  - PNJ rápido por rol (método Rata callejera con respuestas automáticas, con o sin vida pasada).
 * Los PNJ se crean en la carpeta «Generador: PNJ», como secuaz (mook) o personaje completo.
 */
import { MODULE_ID } from "./logic/core.js";
import { npcPlan, encounterFor, autoAnswers, TIERS } from "./logic/npcs.js";
import { loadData, packChoices } from "./data.js";
import { rollToChat } from "./rolls.js";
import { itemData, withQty, applySkills, applyCharacter } from "./apply.js";
import { openGenerator } from "./wizard.js";

const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const STATS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const GM_ROLL = () => CONST.DICE_ROLL_MODES.PRIVATE;

/**
 * Crea un actor con la clase de RED (que añade habilidades base y ranuras de ciberequipo). En RED v0.92.4 el create de los
 * secuaces (cpr-mook.js) llama a super.create sin await ni return: devuelve undefined y el actor aparece después. Se marca
 * el actor con un identificador único y se espera a su hook createActor (y a que RED instale sus ranuras de ciberequipo).
 */
export async function createActor(data) {
  const token = foundry.utils.randomID();
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.createToken`, token);
  const byToken = () => game.actors.find((a) => a.getFlag(MODULE_ID, "createToken") === token);
  const created = new Promise((resolve) => {
    const id = Hooks.on("createActor", (a) => { if (a.getFlag(MODULE_ID, "createToken") === token) { Hooks.off("createActor", id); resolve(a); } });
    setTimeout(() => { Hooks.off("createActor", id); resolve(byToken()); }, 10000);
  });
  const ret = await Actor.implementation.create(data);
  const actor = ret ?? byToken() ?? await created;
  // RED instala sus ranuras de ciberequipo con un update justo después de crear el actor: se espera a que termine.
  for (let i = 0; i < 20 && actor && actor.itemTypes.cyberware.some((c) => c.system.core) && !actor.system.installedItems?.list?.length; i++) await new Promise((r) => setTimeout(r, 150));
  return actor;
}

async function npcFolder() {
  const name = L("npc.folder");
  return game.folders.find((f) => f.type === "Actor" && f.name === name) ?? Folder.create({ name, type: "Actor" });
}

/** Opciones HTML de los idiomas de RED, con el español preseleccionado si existe. */
async function languageOptions() {
  const langs = await packChoices("core_skills-languages");
  const def = langs.find((l) => /spanish|español/i.test(l.name));
  return langs.map((l) => `<option value="${l.uuid}" ${l === def ? "selected" : ""}>${esc(l.name)}</option>`).join("");
}

const typeOptions = () => `<option value="mook">${L("npc.typeMook")}</option><option value="character">${L("npc.typeCharacter")}</option>`;
const field = (label, html) => `<div class="form-group"><label>${label}</label><div class="form-fields">${html}</div></div>`;

/** Menú del botón «Generador de personajes» del directorio (DJ). */
export async function openMenu() {
  const choice = await new Promise((resolve) => new Dialog({
    title: L("menu.title"),
    content: `<p>${L("menu.body")}</p>`,
    buttons: {
      pc: { icon: '<i class="fas fa-user"></i>', label: L("menu.pc"), callback: () => resolve("pc") },
      book: { icon: '<i class="fas fa-book"></i>', label: L("menu.book"), callback: () => resolve("book") },
      encounter: { icon: '<i class="fas fa-dice"></i>', label: L("menu.encounter"), callback: () => resolve("encounter") },
      quick: { icon: '<i class="fas fa-bolt"></i>', label: L("menu.quick"), callback: () => resolve("quick") },
    },
    close: () => resolve(null),
  }, { classes: ["dialog", "cprgen-menu"], width: 460 }).render(true));
  if (choice === "pc") return createPc();
  if (choice === "book") return bookDialog();
  if (choice === "encounter") return encounterDialog();
  if (choice === "quick") return quickDialog();
}

async function createPc() {
  const name = await Dialog.prompt({
    title: L("create.title"),
    content: `<p>${L("create.body")}</p><input type="text" name="name" value="${L("create.default")}" autofocus>`,
    label: L("create.ok"),
    callback: (html) => (html[0] ?? html).querySelector("input[name=name]").value.trim(),
    rejectClose: false,
  });
  if (!name) return;
  // Actor.implementation (la clase de RED) añade las habilidades base y las ranuras de ciberequipo; Actor.create no.
  const actor = await createActor({ name, type: "character" });
  if (actor) openGenerator(actor);
}

const form = (html) => (html[0] ?? html).querySelector("form") ?? (html[0] ?? html);

async function bookDialog() {
  const { npcs } = (await loadData()).npcs;
  const opts = TIERS.map((t) => `<optgroup label="${L(`npc.tier.${t}`)}">${npcs.filter((n) => n.tier === t).map((n) => `<option value="${n.key}">${esc(n.name)}</option>`).join("")}</optgroup>`).join("");
  const res = await Dialog.prompt({
    title: L("menu.book"),
    content: `<form>${field(L("npc.template"), `<select name="key">${opts}</select>`)}${field(L("npc.name"), `<input type="text" name="name" placeholder="${L("npc.namePlaceholder")}">`)}
      ${field(L("npc.type"), `<select name="type">${typeOptions()}</select>`)}${field(L("npc.language"), `<select name="lang">${await languageOptions()}</select>`)}</form>`,
    label: L("npc.create"),
    callback: (html) => Object.fromEntries(new FormData(form(html))),
    rejectClose: false,
  });
  if (!res) return;
  const npc = npcs.find((n) => n.key === res.key);
  const actor = await createBookNpc(npc, { name: res.name || npc.name, type: res.type, languageUuid: res.lang });
  actor?.sheet.render(true);
}

/** Crea un PNJ a partir de una ficha del libro. `note` se añade a las notas (texto de un encuentro). */
export async function createBookNpc(npc, { name, type = "mook", languageUuid = null, note = "" } = {}) {
  const lang = languageUuid ? await fromUuid(languageUuid) : null;
  const plan = npcPlan(npc, { languageUuid, languageText: lang?.name ?? "" });
  const folder = await npcFolder();
  const actor = await createActor({ name, type, folder: folder.id, flags: { [MODULE_ID]: { npc: npc.key } } });
  const log = [];
  const upd = {};
  for (const k of STATS) upd[`system.stats.${k}.value`] = plan.stats[k];
  upd["system.stats.luck.max"] = plan.stats.luck;
  upd["system.stats.emp.max"] = plan.stats.emp;
  upd["system.derivedStats.humanity.max"] = plan.stats.emp * 10;
  upd["system.derivedStats.humanity.value"] = plan.stats.emp * 10;
  upd["system.derivedStats.hp.max"] = plan.hp;
  upd["system.derivedStats.hp.value"] = plan.hp;
  const notes = [`<p><strong>${L("npc.notesSource", { name: esc(npc.name), tier: L(`npc.tier.${npc.tier}`) })}</strong></p>`];
  if (plan.below.length) notes.push(`<p>${L("npc.notesBelow", { list: plan.below.map((b) => `${esc(b.label)} (${b.base})`).join(", ") })}</p>`);
  if (plan.unresolved.length) notes.push(`<p>${L("npc.notesUnresolved", { list: plan.unresolved.map(esc).join(", ") })}</p>`);
  if (note) notes.push(note);
  upd["system.information.notes"] = notes.join("");
  await actor.update(upd);
  await applySkills(actor, plan.skills, log);
  if (plan.role) {
    const r = await itemData(plan.role.uuid);
    r.system.rank = plan.role.rank;
    const [role] = await actor.createEmbeddedDocuments("Item", [r]);
    await actor.update({ "system.roleInfo.activeRole": role.name });
  }
  const toCreate = [];
  for (const it of plan.items) {
    const d = await itemData(it.uuid);
    if (it.equip && foundry.utils.hasProperty(d, "system.equipped")) d.system.equipped = "equipped";
    toCreate.push(...withQty(d, it.qty));
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  // Ciberequipo: cada fundacional (cantidad = número de piezas) y sus opciones repartidas entre esas piezas.
  // Sin pérdida de Humanidad: la EMP del libro ya la tiene en cuenta.
  for (const c of plan.cyber) {
    const base = await itemData(c.uuid);
    const bases = await actor.createEmbeddedDocuments("Item", Array.from({ length: c.qty }, () => foundry.utils.deepClone(base)));
    for (const b of bases) {
      const item = actor.items.get(b.id);
      const target = item.system.isFoundational ? actor
        : actor.itemTypes.cyberware.find((x) => x.id !== item.id && x.system.isInstalled && x.system.isFoundational && x.system.type === item.system.type) ?? actor;
      await target.installItems([item]);
    }
    let n = 0;
    for (const o of c.options) {
      const od = await itemData(o.uuid);
      const opts = await actor.createEmbeddedDocuments("Item", Array.from({ length: o.qty }, () => foundry.utils.deepClone(od)));
      for (const oi of opts) {
        const parent = actor.items.get(bases[n % bases.length].id); n++;
        const ok = parent.system.installedItems && parent.availableInstallSlots?.() >= (oi.system.size ?? 0) ? await parent.installItems([actor.items.get(oi.id)]) : false;
        if (!ok) await actor.installItems([actor.items.get(oi.id)]); // sin hueco en su fundacional: directamente en el cuerpo
      }
    }
  }
  // Las estadísticas del libro ya incluyen los efectos del ciberequipo (p. ej., +2 TCO del implante de hueso y músculo del
  // ciberpsicópata): se corrige el valor base para que el valor final de la ficha sea el del libro.
  const fix = {};
  for (const k of STATS) {
    const shown = actor.system.stats[k].value, base = actor._source.system.stats[k].value;
    if (shown !== plan.stats[k]) fix[`system.stats.${k}.value`] = Math.max(0, plan.stats[k] - (shown - base));
  }
  if (Object.keys(fix).length) await actor.update(fix);
  return actor;
}

async function encounterDialog() {
  const data = await loadData();
  const res = await Dialog.prompt({
    title: L("menu.encounter"),
    content: `<form><p>${L("encounter.intro")}</p>${field(L("encounter.table"), `<select name="table">${data.encounters.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select>`)}</form>`,
    label: L("encounter.roll"),
    callback: (html) => Object.fromEntries(new FormData(form(html))),
    rejectClose: false,
  });
  if (!res) return;
  const table = data.encounters.find((t) => t.id === res.table);
  const total = await rollToChat(null, "1d100", `${esc(table.title)}`, GM_ROLL());
  const entry = encounterFor(table, total);
  const text = `<p><strong>${esc(table.title)} (${total}): ${esc(entry.title)}</strong></p><p>${esc(entry.text)}</p>`;
  await ChatMessage.create({ content: text, whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id) });
  const npcs = data.npcs.npcs;
  const checks = entry.uses.map((k) => { const n = npcs.find((x) => x.key === k); return `<div class="form-group"><label><input type="checkbox" name="use" value="${k}" checked> ${esc(n.name)} <em>(${L(`npc.tier.${n.tier}`)})</em></label></div>`; }).join("");
  const create = await Dialog.prompt({
    title: `${esc(entry.title)} (${total})`,
    content: `<form class="cprgen-encounter"><p>${esc(entry.text)}</p>${entry.uses.length ? `<p><strong>${L("encounter.create")}</strong></p>${checks}${field(L("npc.type"), `<select name="type">${typeOptions()}</select>`)}${field(L("npc.language"), `<select name="lang">${await languageOptions()}</select>`)}<p class="hint">${L("encounter.hint")}</p>` : `<p class="hint">${L("encounter.noNpc")}</p>`}</form>`,
    label: entry.uses.length ? L("npc.create") : L("encounter.close"),
    callback: (html) => { const f = form(html); return { uses: [...f.querySelectorAll("input[name=use]:checked")].map((i) => i.value), type: f.querySelector("[name=type]")?.value, lang: f.querySelector("[name=lang]")?.value }; },
    rejectClose: false,
    options: { width: 560 },
  });
  if (!create?.uses?.length) return;
  for (const k of create.uses) {
    const npc = npcs.find((x) => x.key === k);
    const note = `<p><strong>${L("encounter.noteTitle", { table: esc(table.title), total, title: esc(entry.title) })}</strong></p><p>${esc(entry.text)}</p>`;
    await createBookNpc(npc, { name: `${entry.title}: ${npc.name}`, type: create.type, languageUuid: create.lang, note });
  }
  ui.notifications.info(L("encounter.created", { n: create.uses.length }));
}

async function quickDialog() {
  const data = await loadData();
  const res = await Dialog.prompt({
    title: L("menu.quick"),
    content: `<form><p>${L("quick.intro")}</p>${field(L("step.role"), `<select name="role">${data.roles.map((r) => `<option value="${r.key}">${esc(r.name)}</option>`).join("")}</select>`)}
      ${field(L("npc.name"), `<input type="text" name="name" placeholder="${L("npc.namePlaceholder")}">`)}${field(L("npc.type"), `<select name="type">${typeOptions()}</select>`)}
      ${field(L("quick.lifepath"), `<input type="checkbox" name="lifepath" checked>`)}</form>`,
    label: L("npc.create"),
    callback: (html) => { const f = form(html); return { role: f.querySelector("[name=role]").value, name: f.querySelector("[name=name]").value.trim(), type: f.querySelector("[name=type]").value, lifepath: f.querySelector("[name=lifepath]").checked }; },
    rejectClose: false,
  });
  if (!res) return;
  const actor = await createQuickNpc(res.role, res);
  actor?.sheet.render(true);
}

/** PNJ rápido por rol: Rata callejera con respuestas automáticas (tiradas sin publicar) y aplicación normal. */
export async function createQuickNpc(roleKey, { name, type = "mook", lifepath = true } = {}) {
  const data = await loadData();
  const role = data.role(roleKey);
  // Mismo generador aleatorio que los dados de Foundry (Roll#evaluateSync no admite dados en V12).
  const roll = (n) => Math.min(n, 1 + Math.floor(CONFIG.Dice.randomUniform() * n));
  const specialtyOptions = {};
  for (const s of role.streetratSkills.filter((x) => x.specialtyPack)) specialtyOptions[s.specialtyPack] = await packChoices(s.specialtyPack);
  const answers = autoAnswers(role, data.lifepath, { roll, specialtyOptions, languages: await packChoices("core_skills-languages"), lifepath });
  const folder = await npcFolder();
  const actor = await createActor({ name: name || L("quick.defaultName", { role: role.name }), type, folder: folder.id, flags: { [MODULE_ID]: { npc: `quick.${roleKey}` } } });
  const draft = { schema: 1, method: "streetrat", step: "review", data: { role: roleKey, answers }, rolls: [] };
  // RED publica tarjetas de pérdida de Humanidad al instalar ciberequipo: con un PNJ, solo para el DJ.
  const prevMode = game.settings.get("core", "rollMode");
  await game.settings.set("core", "rollMode", CONST.DICE_ROLL_MODES.PRIVATE);
  try { await applyCharacter(actor, data, draft, game.user.id, { whisper: true }); }
  finally { await game.settings.set("core", "rollMode", prevMode); }
  return actor;
}
