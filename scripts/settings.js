import { MODULE_ID, ROLL_POLICIES } from "./logic/core.js";

/** Puntos de característica por rango de personaje (Core, «Cómo obtienes tus características»). */
export const COMPLETE_RANKS = [50, 62, 70, 75, 80];

export function registerSettings() {
  // Autorización de los jugadores: el DJ la abre durante la creación y la cierra al terminar.
  game.settings.register(MODULE_ID, "playersEnabled", {
    name: "CPRGEN.settings.playersEnabled.name",
    hint: "CPRGEN.settings.playersEnabled.hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: (on) => playersAccessChanged(on),
  });
  game.settings.register(MODULE_ID, "rollPolicy", {
    name: "CPRGEN.settings.rollPolicy.name",
    hint: "CPRGEN.settings.rollPolicy.hint",
    scope: "world", config: true, type: String, default: "free",
    choices: Object.fromEntries(ROLL_POLICIES.map((p) => [p, `CPRGEN.settings.rollPolicy.${p}`])),
    onChange: () => rerenderOpen(),
  });
  // Partida de Edgerunners (paso 7): tienda del Mission Kit + RED al doble y neuropuerto de creación. Requiere el motor
  // edgerunners-2070 y el Mission Kit; sin ellos, el generador sigue como RED y avisa al DJ.
  game.settings.register(MODULE_ID, "edgerunnersGame", {
    name: "CPRGEN.settings.edgerunnersGame.name",
    hint: "CPRGEN.settings.edgerunnersGame.hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => { warnEdgerunners(); rerenderOpen(); },
  });
  game.settings.register(MODULE_ID, "completeRank", {
    name: "CPRGEN.settings.completeRank.name",
    hint: "CPRGEN.settings.completeRank.hint",
    scope: "world", config: true, type: Number, default: 62,
    choices: Object.fromEntries(COMPLETE_RANKS.map((p) => [p, `CPRGEN.settings.completeRank.r${p}`])),
    onChange: () => rerenderOpen(),
  });
}

export const setting = (key) => game.settings.get(MODULE_ID, key);

/** Módulos que necesita la «Partida de Edgerunners». */
export const EDGERUNNERS_MODULES = ["edgerunners-2070", "edgerunners-mission-kit"];
export const missingEdgerunnersModules = () => EDGERUNNERS_MODULES.filter((id) => !game.modules.get(id)?.active);

/** ¿Está activa la «Partida de Edgerunners»? (ajuste activado y motor y Mission Kit activos). */
export function edgerunnersMode() {
  try { return setting("edgerunnersGame") === true && missingEdgerunnersModules().length === 0; } catch { return false; }
}

/** Aviso al DJ si el ajuste está activado pero faltan módulos. */
export function warnEdgerunners() {
  if (!game.user?.isGM) return;
  let on = false;
  try { on = setting("edgerunnersGame"); } catch { return; }
  const missing = missingEdgerunnersModules();
  if (on && missing.length) ui.notifications.warn(game.i18n.format("CPRGEN.settings.edgerunnersGame.missing", { modules: missing.join(", ") }), { permanent: true });
}

/** Vuelve a dibujar los asistentes abiertos (por ejemplo, al cambiar un ajuste). */
export function rerenderOpen() {
  for (const app of foundry.applications.instances.values()) if (app.constructor?.isCprGenerator) app.render();
}

/**
 * Cambio de la autorización de los jugadores, con efecto inmediato en cada cliente de jugador:
 * al bloquear, desaparece el botón de las fichas abiertas y se cierran sus asistentes; al autorizar,
 * las fichas abiertas se vuelven a abrir para que aparezca el botón.
 */
async function playersAccessChanged(on) {
  if (game.user.isGM) return rerenderOpen();
  ui.notifications.info(game.i18n.localize(on ? "CPRGEN.settings.playersEnabled.opened" : "CPRGEN.settings.playersEnabled.closed"));
  if (!on) {
    document.querySelectorAll(".cprgen-open").forEach((b) => b.remove());
    for (const app of [...foundry.applications.instances.values()]) if (app.constructor?.isCprGenerator) await app.close();
    return;
  }
  for (const w of Object.values(ui.windows)) {
    if (w instanceof ActorSheet && ["character"].includes(w.actor?.type) && w.actor.isOwner) { await w.close(); w.render(true); }
  }
}
