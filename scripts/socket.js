/**
 * Canal del módulo: un cliente pide y el DJ activo ejecuta, tras comprobar quién lo pide.
 * Mismo patrón que edgerunners-2070 (effects.js): manejadores registrados con clave propia.
 */
import { MODULE_ID } from "./logic/core.js";

const HANDLERS = Object.create(null);
const own = (obj, key) => (typeof key === "string" && Object.hasOwn(obj, key) ? obj[key] : undefined);
const isActiveGM = () => game.user === game.users.activeGM;

export const registerHandler = (name, fn) => { HANDLERS[name] = fn; };

/** Ejecuta un manejador en el DJ activo (localmente si este cliente lo es). */
export async function gmExec(name, data) {
  if (isActiveGM()) return own(HANDLERS, name)?.(data, game.user.id);
  if (!game.users.activeGM) return ui.notifications.error(game.i18n.localize("CPRGEN.noGM"));
  game.socket.emit(`module.${MODULE_ID}`, { name, data });
}

export function listenSocket() {
  game.socket.on(`module.${MODULE_ID}`, async (message, userId) => {
    if (!isActiveGM() || typeof userId !== "string" || !game.users.get(userId)) return;
    const fn = own(HANDLERS, message?.name);
    if (!fn) return;
    try { await fn(message.data ?? {}, userId); } catch (err) { console.error(`${MODULE_ID} |`, err); }
  });
}
