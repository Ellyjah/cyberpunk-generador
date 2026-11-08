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

const STATS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const LP_FIELDS = ["aboutPeople", "affectations", "childhoodEnvironment", "clothingStyle", "culturalOrigin", "enemies", "familyBackground", "familyCrisis", "friends", "hairStyle", "lifeGoals", "personality", "roleLifepath", "tragicLoveAffairs", "valueMost", "valuedPerson", "valuedPossession"];
const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});

async function itemData(uuid) {
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
export async function undoApplied(actor, record) {
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
  if (record?.money) {
    const wealth = actor.system.wealth;
    const total = (wealth.value ?? 0) - record.money;
    await actor.update({
      "system.wealth.value": total,
      "system.wealth.transactions": [...(wealth.transactions ?? []), [game.i18n.format("CPR.ledger.decreaseSentence", { property: "wealth", amount: record.money, total }), L("apply.moneyUndo")]],
    });
  }
  await actor.update({ "system.roleInfo.activeRole": "" });
  log.push(L("apply.log.undo", { items: ids.length, skills: resetSkills.length, money: record?.money ?? 0 }));
  return log;
}

/** Datos de Items para un objeto con cantidad: apilables con system.amount; los demás, repetidos. */
function withQty(data, qty) {
  if (qty <= 1) return [data];
  if (foundry.utils.hasProperty(data, "system.amount")) return [{ ...data, system: { ...data.system, amount: qty } }];
  return Array.from({ length: qty }, () => foundry.utils.deepClone(data));
}

async function clothingIndex() {
  const pack = game.packs.get("cyberpunk-red-core.core_clothing");
  return pack.getIndex({ fields: ["system.style", "system.type"] });
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

export async function applyPlan(actor, plan) {
  // Una ficha creada por código con Actor.create (no Actor.implementation) no tiene las habilidades base de RED.
  if (!actor.itemTypes.skill.some((i) => i.system.core)) throw new Error(L("apply.noCoreSkills"));
  const log = [];
  // 1. Características, Humanidad, vida pasada y estilo de vida.
  const upd = {};
  for (const k of STATS) upd[`system.stats.${k}.value`] = plan.stats[k];
  upd["system.stats.luck.max"] = plan.stats.luck;
  upd["system.stats.emp.max"] = plan.stats.emp;
  upd["system.derivedStats.humanity.max"] = plan.stats.emp * 10;
  upd["system.derivedStats.humanity.value"] = plan.stats.emp * 10;
  for (const f of LP_FIELDS) upd[`system.lifepath.${f}`] = plan.lifepath[f] ?? "";
  upd["system.lifestyle.housing.description"] = plan.housing.housing.description;
  upd["system.lifestyle.housing.cost"] = plan.housing.housing.cost;
  upd["system.lifestyle.lifeStyle.description"] = plan.housing.lifestyle.description;
  upd["system.lifestyle.lifeStyle.cost"] = plan.housing.lifestyle.cost;
  await actor.update(upd);
  const hp = actor.calcMaxHp();
  await actor.update({ "system.derivedStats.hp.max": hp, "system.derivedStats.hp.value": hp });
  log.push(L("apply.log.stats"));

  // 2. Habilidades: las de la ficha (RED las crea con el actor) cambian de nivel; especialidades e idioma se añaden.
  // Las habilidades base de la ficha llevan el nombre visible del compendio interno de RED (traducido por Babele si está
  // activo); se buscan por el nombre actual del Item del compendio o por el nombre interno en inglés.
  const skillIndex = await game.packs.get("cyberpunk-red-core.internal_skills").getIndex();
  const visibleName = (en) => skillIndex.find((e) => e.name === en || e.originalName === en || e.flags?.babele?.originalName === en)?.name;
  const skillUpd = [], newSkills = [];
  for (const s of plan.skills) {
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
  if (skillUpd.length) await actor.updateEmbeddedDocuments("Item", skillUpd);
  const coreSkills = skillUpd.map((u) => u._id);
  if (newSkills.length) await actor.createEmbeddedDocuments("Item", newSkills);
  log.push(L("apply.log.skills", { n: skillUpd.length + newSkills.length }));

  // 3. Rol con rango 4, rol activo.
  const roleData = await itemData(plan.roleUuid);
  roleData.system.rank = plan.roleRank;
  const [roleItem] = await actor.createEmbeddedDocuments("Item", [roleData]);
  await actor.update({ "system.roleInfo.activeRole": roleItem.name });
  log.push(L("apply.log.role", { name: roleItem.name }));

  // 4. Equipo y ropa.
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
  const created = await actor.createEmbeddedDocuments("Item", toCreate);
  log.push(L("apply.log.items", { n: created.length }));

  // 5. Ciberequipo: primero el fundacional; cada opción en su fundacional del mismo tipo (o en la ficha si no hay).
  const cyber = created.filter((i) => i.type === "cyberware").sort((a, b) => Number(b.system.isFoundational) - Number(a.system.isFoundational));
  const installed = [];
  for (const cw of cyber) {
    const item = actor.items.get(cw.id);
    const target = item.system.isFoundational ? actor
      : actor.itemTypes.cyberware.find((c) => c.id !== item.id && c.system.isInstalled && c.system.isFoundational && c.system.type === item.system.type);
    if (!target) log.push(L("apply.log.noFoundation", { name: item.name }));
    if (await (target ?? actor).installItems([item])) installed.push(actor.items.get(item.id));
  }
  if (installed.length) await actor.loseHumanityValue(installed, "static");
  log.push(L("apply.log.cyber", { n: installed.length, hum: actor.system.derivedStats.humanity.value, emp: actor.system.stats.emp.value }));

  // 6. Dinero inicial en el libro de cuentas de RED.
  const wealth = actor.system.wealth;
  const total = (wealth.value ?? 0) + plan.money;
  await actor.update({
    "system.wealth.value": total,
    "system.wealth.transactions": [...(wealth.transactions ?? []), [game.i18n.format("CPR.ledger.increaseSentence", { property: "wealth", amount: plan.money, total }), L("apply.moneyReason")]],
  });
  log.push(L("apply.log.money", { n: plan.money }));
  return { log, coreSkills, money: plan.money };
}

/**
 * Aplica el borrador a la ficha, sustituyendo la aplicación anterior si la hay. Lo llama el DJ, o el propietario
 * en la primera aplicación; la autorización de una reaplicación se comprueba en wizard.js antes de llegar aquí.
 */
export async function applyCharacter(actor, data, draft, userId = game.user.id) {
  const previous = appliedRecord(actor);
  const plan = buildPlan(data, draft);
  const log = previous ? await undoApplied(actor, previous) : [];
  const res = await applyPlan(actor, plan);
  log.push(...res.log);
  const record = { at: Date.now(), by: userId, method: draft.method, money: res.money, coreSkills: res.coreSkills, replaced: Boolean(previous) };
  await actor.setFlag(MODULE_ID, "applied", JSON.stringify(record));
  await actor.setFlag(MODULE_ID, "draft", JSON.stringify(markApplied(draft, userId)));
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${L(previous ? "apply.doneReplaced" : "apply.done")}</strong></p><ul>${log.map((l) => `<li>${l}</li>`).join("")}</ul>` });
  return log;
}

/** Marca el borrador como aplicado (fecha y quién) sin perder lo elegido. */
export function markApplied(draft, userId = game.user.id) {
  return { ...draft, appliedAt: Date.now(), appliedBy: userId };
}
