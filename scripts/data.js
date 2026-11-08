/** Carga (una vez) las tablas de data/*.json, generadas por tools/extract_core_tables.py. */
import { MODULE_ID } from "./logic/core.js";

let cache = null;
export async function loadData() {
  if (cache) return cache;
  const get = async (f) => (await fetch(`modules/${MODULE_ID}/data/${f}`)).json();
  const [roles, lifepath, skills, rules] = await Promise.all(["roles.json", "lifepath.json", "skills.json", "rules.json"].map(get));
  cache = { roles, lifepath, skills, rules, role: (key) => roles.find((r) => r.key === key) };
  return cache;
}

/** Índice de un compendio de RED (para elegir especialidades e idiomas), ordenado por nombre visible. */
export async function packChoices(pack) {
  const p = game.packs.get(`cyberpunk-red-core.${pack}`);
  if (!p) return [];
  const index = await p.getIndex();
  return index.map((e) => ({ uuid: e.uuid ?? `Compendium.cyberpunk-red-core.${pack}.Item.${e._id}`, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}
