/**
 * Aplicación del borrador a la ficha de RED (paso «Revisión»). Escribe como lo haría RED:
 * características en system.stats.*, Humanidad = EMP × 10 y pérdida media (static) al instalar el ciberequipo
 * con loseHumanityValue (como el diálogo de RED con «pérdida media»), habilidades en los Items skill de la ficha,
 * rol con rango 4, Items de los compendios de RED, vida pasada en system.lifepath.*, dinero en el libro de cuentas
 * y estilo de vida y alojamiento.
 *
 * Sustitución (0.3.1): cada Item creado lleva flags.cyberpunk-generador.generated y la ficha guarda el registro de la
 * aplicación en flags.cyberpunk-generador.applied (texto JSON: {at, by, method, money, coreSkills}). Una nueva aplicación
 * deshace la anterior (desinstala y borra los Items generados, devuelve a 0 las habilidades base tocadas y retira el dinero)
 * antes de aplicar. Los Items que no creó el generador no se tocan. Reaplicar exige la autorización del DJ (wizard.js).
 */
import { MODULE_ID } from "./logic/core.js";
import { lifepathFields } from "./logic/lifepath.js";
import { planFor } from "./logic/methods.js";
import { edgerunnersMode } from "./settings.js";

const ER = "edgerunners-2070";
const capsOf = (item) => (item.flags?.[ER]?.capabilities ?? []).filter((c) => c?.enabled !== false).map((c) => c.type);

/** Neuropuerto de creación del Mission Kit: el Item con la capacidad «neuroport» y creationFree. */
async function findCreationNeuroport() {
  const pack = game.packs.get("edgerunners-mission-kit.objetos");
  if (!pack) return null;
  const index = await pack.getIndex({ fields: [`flags.${ER}.capabilities`] });
  const e = index.find((x) => (x.flags?.[ER]?.capabilities ?? []).some((c) => c.type === "neuroport" && c.creationFree));
  return e ? (e.uuid ?? `Compendium.edgerunners-mission-kit.objetos.Item.${e._id}`) : null;
}

const STATS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const LP_FIELDS = ["aboutPeople", "affectations", "childhoodEnvironment", "clothingStyle", "culturalOrigin", "enemies", "familyBackground", "familyCrisis", "friends", "hairStyle", "lifeGoals", "personality", "roleLifepath", "tragicLoveAffairs", "valueMost", "valuedPerson", "valuedPossession"];
const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});

export async function itemData(uuid) {
  const doc = await fromUuid(uuid);
  if (!doc) throw new Error(L("apply.missingItem", { uuid }));
  const data = doc.toObject();
  delete data._id;
  // Marca de Item creado por el generador (para poder sustituirlo en una nueva aplicación).
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.generated`, true);
  return data;
}

/** Registro de la última aplicación (o null). */
export function appliedRecord(actor) {
  const raw = actor.getFlag(MODULE_ID, "applied");
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}

/** Deshace una aplicación anterior: Items generados, habilidades base tocadas y dinero. */
export async function undoApplied(actor, record, extra = {}) {
  const log = [];
  const generated = actor.items.filter((i) => i.getFlag(MODULE_ID, "generated"));
  // Ciberequipo: primero las opciones y después los fundacionales, cada uno desde su contenedor.
  const cyber = generated.filter((i) => i.type === "cyberware").sort((a, b) => Number(a.system.isFoundational) - Number(b.system.isFoundational));
  for (const cw of cyber) {
    const item = actor.items.get(cw.id);
    if (!item) continue;
    const parent = actor.system.installedItems?.list?.includes(item.id) ? actor : actor.items.find((i) => i.system.installedItems?.list?.includes(item.id));
    if (parent) await parent.uninstallItems([item], { recursive: false, unloadAmmo: true });
  }
  const ids = generated.map((i) => i.id).filter((id) => actor.items.has(id));
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  // Limpia referencias a Items borrados en las listas de instalación (por si quedara alguna).
  const stale = [];
  for (const c of actor.items) {
    const list = c.system.installedItems?.list;
    if (Array.isArray(list) && list.some((id) => !actor.items.has(id))) stale.push({ _id: c.id, "system.installedItems.list": list.filter((id) => actor.items.has(id)) });
  }
  if (stale.length) await actor.updateEmbeddedDocuments("Item", stale);
  const resetSkills = (record?.coreSkills ?? []).filter((id) => actor.items.has(id)).map((id) => ({ _id: id, "system.level": 0 }));
  if (resetSkills.length) await actor.updateEmbeddedDocuments("Item", resetSkills);
  // Dinero, rol activo y `extra` (1.0.1: el registro pendiente de la nueva aplicación) en una sola actualización, para
  // que una interrupción no devuelva el dinero dos veces.
  const upd = { "system.roleInfo.activeRole": "", ...extra };
  if (record?.money && actor.system.wealth) {
    const wealth = actor.system.wealth;
    const total = (wealth.value ?? 0) - record.money;
    upd["system.wealth.value"] = total;
    upd["system.wealth.transactions"] = [...(wealth.transactions ?? []), [game.i18n.format("CPR.ledger.decreaseSentence", { property: "wealth", amount: record.money, total }), L("apply.moneyUndo")]];
  }
  await actor.update(upd);
  log.push(L("apply.log.undo", { items: ids.length, skills: resetSkills.length, money: record?.money ?? 0 }));
  return log;
}

/** Datos de Items para un objeto con cantidad: apilables con system.amount; los demás, repetidos. */
export function withQty(data, qty) {
  if (qty <= 1) return [data];
  if (foundry.utils.hasProperty(data, "system.amount")) return [{ ...data, system: { ...data.system, amount: qty } }];
  return Array.from({ length: qty }, () => foundry.utils.deepClone(data));
}

async function clothingIndex() {
  const pack = game.packs.get("cyberpunk-red-core.core_clothing");
  return pack.getIndex({ fields: ["system.style", "system.type"] });
}

/**
 * Habilidades: las de la ficha (RED las crea con el actor) cambian de nivel; especialidades e idioma se añaden.
 * Las habilidades base de la ficha llevan el nombre visible del compendio interno de RED (traducido por Babele si está
 * activo); se buscan por el nombre actual del Item del compendio o por el nombre interno en inglés.
 * Devuelve los ids de las habilidades base ajustadas (para poder deshacerlo). La usan los PJ y los PNJ.
 */
export async function applySkills(actor, skills, log) {
  const { skillUpd, newSkills } = await resolveSkills(actor, skills, log);
  return writeSkills(actor, { skillUpd, newSkills }, log);
}

/** 1.0.1 (H01): resuelve las habilidades sin escribir nada en la ficha. */
export async function resolveSkills(actor, skills, log) {
  const skillIndex = await game.packs.get("cyberpunk-red-core.internal_skills").getIndex();
  const visibleName = (en) => skillIndex.find((e) => e.name === en || e.originalName === en || e.flags?.babele?.originalName === en)?.name;
  const skillUpd = [], newSkills = [];
  for (const s of skills) {
    if (s.red) {
      const it = actor.itemTypes.skill.find((i) => i.name === s.red || i.name === visibleName(s.red) || (s.redId && i.name === skillIndex.get(s.redId)?.name));
      if (it) skillUpd.push({ _id: it.id, "system.level": s.level });
      else log.push(L("apply.log.skillMissing", { name: s.label }));
    } else if (s.uuid) {
      const d = await itemData(s.uuid);
      d.system.level = s.level;
      newSkills.push(d);
    } else {
      // Idioma no listado en el compendio: copia de un idioma de RED con otro nombre.
      const pack = game.packs.get("cyberpunk-red-core.core_skills-languages");
      const first = (await pack.getIndex()).contents[0];
      const d = await itemData(first.uuid ?? `Compendium.cyberpunk-red-core.core_skills-languages.Item.${first._id}`);
      d.name = L("apply.languageName", { name: s.text });
      d.system.level = s.level;
      newSkills.push(d);
    }
  }
  return { skillUpd, newSkills };
}

/** Escribe las habilidades resueltas. Devuelve los ids de las habilidades base ajustadas. */
async function writeSkills(actor, { skillUpd, newSkills }, log) {
  if (skillUpd.length) await actor.updateEmbeddedDocuments("Item", skillUpd);
  if (newSkills.length) await actor.createEmbeddedDocuments("Item", newSkills);
  log.push(L("apply.log.skills", { n: skillUpd.length + newSkills.length }));
  return skillUpd.map((u) => u._id);
}

export function buildPlan(data, draft) {
  const role = data.role(draft.data.role);
  const answers = draft.data.answers ?? {};
  const rules = { ...data.rules, completePoints: game.settings.get(MODULE_ID, "completeRank") };
  const plan = planFor(draft.method, role, answers, rules, data.skills);
  plan.lifepath = lifepathFields(data.lifepath, role.lifepath, answers, {
    none: L("lifepath.none"), wrongedTitle: L("lifepath.wronged"), languageLabel: L("lifepath.language"),
  });
  return plan;
}

/**
 * 1.0.1 (H01): la aplicación tiene dos fases. Primero se resuelve todo lo que viene de los compendios (habilidades, rol,
 * equipo, ropa y neuropuerto) sin escribir nada: si algo falla, la ficha queda intacta. Después se llama a `before`
 * (applyCharacter deshace la aplicación anterior y guarda un registro «pendiente» con las habilidades base que se van a
 * tocar) y se escribe. Si una escritura falla, el reintento deshace lo generado a partir de ese registro y no duplica.
 * El dinero no se escribe aquí: se devuelve para guardarlo junto con el registro final en una sola actualización.
 */
export async function applyPlan(actor, plan, { before } = {}) {
  // Una ficha creada por código con Actor.create (no Actor.implementation) no tiene las habilidades base de RED.
  if (!actor.itemTypes.skill.some((i) => i.system.core)) throw new Error(L("apply.noCoreSkills"));
  const log = [];
  // 0. Resolución sin escrituras.
  const skills = await resolveSkills(actor, plan.skills, log);
  const roleData = await itemData(plan.roleUuid);
  roleData.system.rank = plan.roleRank;
  const toCreate = [];
  for (const it of plan.items) {
    const d = await itemData(it.uuid);
    // Armas y blindaje iniciales, equipados (si no, la pestaña Combate de RED aparece vacía).
    if (["weapon", "armor"].includes(d.type) && foundry.utils.hasProperty(d, "system.equipped")) d.system.equipped = "equipped";
    toCreate.push(...withQty(d, it.qty));
  }
  const clothes = await clothingIndex();
  for (const c of plan.clothing) {
    const e = clothes.find((x) => x.system?.style === c.style && x.system?.type === c.type);
    if (!e) { log.push(L("apply.log.clothingMissing", { name: c.text })); continue; }
    toCreate.push(...withQty(await itemData(e.uuid ?? `Compendium.cyberpunk-red-core.core_clothing.Item.${e._id}`), c.qty));
  }
  // Partida de Edgerunners: neuropuerto de creación del Mission Kit si hay ciberequipo que no sea de grado médico.
  const edgerunners = edgerunnersMode();
  let portData = null;
  if (edgerunners) {
    const cyberData = toCreate.filter((d) => d.type === "cyberware");
    const hasPort = cyberData.some((d) => capsOf(d).includes("neuroport"));
    const needs = cyberData.some((d) => !capsOf(d).includes("neuroport") && !capsOf(d).includes("medical-grade") && !/grado m[eé]dico|medical grade/i.test(d.name));
    if (needs && !hasPort) {
      const uuid = await findCreationNeuroport();
      if (uuid) portData = await itemData(uuid);
      else log.push(L("apply.log.noNeuroport"));
    }
  }
  const coreSkills = skills.skillUpd.map((u) => u._id);
  if (before) await before({ coreSkills });

  // 1. Características, Humanidad, vida pasada y estilo de vida.
  const upd = {};
  for (const k of STATS) upd[`system.stats.${k}.value`] = plan.stats[k];
  upd["system.stats.luck.max"] = plan.stats.luck;
  upd["system.stats.emp.max"] = plan.stats.emp;
  upd["system.derivedStats.humanity.max"] = plan.stats.emp * 10;
  upd["system.derivedStats.humanity.value"] = plan.stats.emp * 10;
  // La ficha de secuaz (mook) de RED no tiene vida pasada, estilo de vida ni dinero: la vida pasada va a sus notas.
  if (actor.system.lifepath) {
    for (const f of LP_FIELDS) upd[`system.lifepath.${f}`] = plan.lifepath[f] ?? "";
  } else {
    const lp = LP_FIELDS.filter((f) => plan.lifepath[f]).map((f) => `<h3>${L(`lifepath.field.${f}`)}</h3>${plan.lifepath[f]}`).join("");
    if (lp) upd["system.information.notes"] = `${actor.system.information?.notes ?? ""}<h2>${L("step.lifepath")}</h2>${lp}`;
  }
  if (actor.system.lifestyle) {
    upd["system.lifestyle.housing.description"] = plan.housing.housing.description;
    upd["system.lifestyle.housing.cost"] = plan.housing.housing.cost;
    upd["system.lifestyle.lifeStyle.description"] = plan.housing.lifestyle.description;
    upd["system.lifestyle.lifeStyle.cost"] = plan.housing.lifestyle.cost;
  }
  await actor.update(upd);
  const hp = actor.calcMaxHp();
  await actor.update({ "system.derivedStats.hp.max": hp, "system.derivedStats.hp.value": hp });
  log.push(L("apply.log.stats"));

  // 2. Habilidades.
  await writeSkills(actor, skills, log);

  // 3. Rol con rango 4, rol activo.
  const [roleItem] = await actor.createEmbeddedDocuments("Item", [roleData]);
  await actor.update({ "system.roleInfo.activeRole": roleItem.name });
  log.push(L("apply.log.role", { name: roleItem.name }));

  // 4. Equipo y ropa.
  const created = await actor.createEmbeddedDocuments("Item", toCreate);
  log.push(L("apply.log.items", { n: created.length }));

  // 5. Ciberequipo: primero el fundacional; cada opción en su fundacional del mismo tipo (o en la ficha si no hay).
  // Partida de Edgerunners: si hay ciberequipo que no sea de grado médico, neuropuerto de creación del Mission Kit, gratis,
  // instalado sin pérdida de Humanidad y marcado para el motor 2070 (install.mode = "creation"; el motor devuelve el −2
  // de Humanidad máxima que resta RED). Las opciones de neuralware van a la conexión neuronal, no al neuropuerto.
  let port = null;
  if (edgerunners) {
    port = created.filter((i) => i.type === "cyberware").find((i) => capsOf(i).includes("neuroport")) ?? null;
    if (!port && portData) { [port] = await actor.createEmbeddedDocuments("Item", [portData]); log.push(L("apply.log.neuroport", { name: port.name })); }
    if (port) {
      await actor.installItems([actor.items.get(port.id)]);
      await actor.items.get(port.id).setFlag(ER, "install", { mode: "creation", at: game.time.worldTime });
    }
  }
  const cyber = created.filter((i) => i.type === "cyberware" && i.id !== port?.id).sort((a, b) => Number(b.system.isFoundational) - Number(a.system.isFoundational));
  const installed = [];
  for (const cw of cyber) {
    const item = actor.items.get(cw.id);
    const bases = actor.itemTypes.cyberware.filter((c) => c.id !== item.id && c.system.isInstalled && c.system.isFoundational && c.system.type === item.system.type);
    const target = item.system.isFoundational ? actor : bases.find((c) => c.id !== port?.id) ?? bases[0];
    if (!target) log.push(L("apply.log.noFoundation", { name: item.name }));
    if (await (target ?? actor).installItems([item])) installed.push(actor.items.get(item.id));
  }
  if (installed.length) await actor.loseHumanityValue(installed, "static");
  else if (port) await actor.setMaxHumanity();
  log.push(L("apply.log.cyber", { n: installed.length, hum: actor.system.derivedStats.humanity.value, emp: actor.system.stats.emp.value }));

  // 6. Dinero inicial en el libro de cuentas de RED (la ficha de secuaz no tiene dinero): se devuelve la actualización
  // para que applyCharacter la escriba junto con el registro final.
  const wealth = actor.system.wealth;
  if (!wealth) return { log, coreSkills, money: 0, moneyUpdate: {} };
  const total = (wealth.value ?? 0) + plan.money;
  log.push(L("apply.log.money", { n: plan.money }));
  return {
    log, coreSkills, money: plan.money,
    moneyUpdate: {
      "system.wealth.value": total,
      "system.wealth.transactions": [...(wealth.transactions ?? []), [game.i18n.format("CPR.ledger.increaseSentence", { property: "wealth", amount: plan.money, total }), L("apply.moneyReason")]],
    },
  };
}

/** Registro terminado (los pendientes son aplicaciones interrumpidas: se deshacen al reintentar sin pedir autorización). */
export const isApplied = (record) => Boolean(record) && !record.pending;

const applying = new Set(); // 1.0.1 (H01): una sola aplicación a la vez por ficha en este cliente

/**
 * Aplica el borrador a la ficha, sustituyendo la aplicación anterior si la hay. Lo llama el DJ, o el propietario
 * en la primera aplicación; la autorización de una reaplicación se comprueba en wizard.js antes de llegar aquí.
 * 1.0.1 (H01): registro «pendiente» antes de la primera escritura y registro final junto con el dinero.
 */
export async function applyCharacter(actor, data, draft, userId = game.user.id, { whisper = false } = {}) {
  if (applying.has(actor.uuid)) throw new Error(L("apply.busy"));
  applying.add(actor.uuid);
  try {
    const previous = appliedRecord(actor);
    const plan = buildPlan(data, draft);
    const log = [];
    const at = Date.now();
    const res = await applyPlan(actor, plan, {
      before: async ({ coreSkills }) => {
        const pending = { [`flags.${MODULE_ID}.applied`]: JSON.stringify({ at, by: userId, method: draft.method, money: 0, coreSkills, replaced: isApplied(previous), pending: true }) };
        if (previous) log.push(...await undoApplied(actor, previous, pending));
        else await actor.update(pending);
      },
    });
    log.push(...res.log);
    const record = { at, by: userId, method: draft.method, money: res.money, coreSkills: res.coreSkills, replaced: isApplied(previous) };
    await actor.update({ ...res.moneyUpdate, [`flags.${MODULE_ID}.applied`]: JSON.stringify(record) });
    await actor.setFlag(MODULE_ID, "draft", JSON.stringify(markApplied(draft, userId)));
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${L(isApplied(previous) ? "apply.doneReplaced" : "apply.done")}</strong></p><ul>${log.map((l) => `<li>${l}</li>`).join("")}</ul>`, ...(whisper ? { whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id) } : {}) });
    return log;
  } finally {
    applying.delete(actor.uuid);
  }
}

/** Marca el borrador como aplicado (fecha y quién) sin perder lo elegido. */
export function markApplied(draft, userId = game.user.id) {
  return { ...draft, appliedAt: Date.now(), appliedBy: userId };
}
