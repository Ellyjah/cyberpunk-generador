import { MODULE_ID, ROLL_POLICIES } from "./logic/core.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, "rollPolicy", {
    name: "CPRGEN.settings.rollPolicy.name",
    hint: "CPRGEN.settings.rollPolicy.hint",
    scope: "world", config: true, type: String, default: "free",
    choices: Object.fromEntries(ROLL_POLICIES.map((p) => [p, `CPRGEN.settings.rollPolicy.${p}`])),
    onChange: () => rerenderOpen(),
  });
  game.settings.register(MODULE_ID, "playersEnabled", {
    name: "CPRGEN.settings.playersEnabled.name",
    hint: "CPRGEN.settings.playersEnabled.hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => rerenderOpen(),
  });
}

export const setting = (key) => game.settings.get(MODULE_ID, key);

/** Vuelve a dibujar los asistentes abiertos (por ejemplo, al cambiar un ajuste). */
export function rerenderOpen() {
  for (const app of foundry.applications.instances.values()) if (app.constructor?.isCprGenerator) app.render();
}
