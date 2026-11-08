/**
 * Lógica pura del generador (sin Foundry): se prueba con `node --test tests/*.test.mjs`.
 * Todo lo que dependa de `game`, `ui` o documentos va en los demás scripts.
 */

export const MODULE_ID = "cyberpunk-generador";
/** Versión del esquema del borrador guardado en la bandera del actor. Subirla exige migración. */
export const DRAFT_SCHEMA = 1;

/** Tipos de actor de RED sobre los que se puede abrir el generador. */
export const ACTOR_TYPES = Object.freeze(["character", "mook"]);

/** Métodos de creación de PJ del Libro de reglas. */
export const METHODS = Object.freeze(["streetrat", "edgerunner", "complete"]);

/** Pasos del asistente de PJ, en orden. Cada método los recorre todos con reglas distintas. */
export const STEPS = Object.freeze(["method", "role", "stats", "skills", "lifepath", "gear", "review"]);

/** Políticas de tirada (ajuste del DJ). */
export const ROLL_POLICIES = Object.freeze(["free", "rollsOnly"]);

/**
 * ¿Puede este usuario usar el generador sobre este actor?
 * El DJ siempre. Un jugador, solo si el DJ lo permite en los ajustes y es propietario de la ficha:
 * el jugador nunca crea actores, trabaja sobre la ficha que el DJ le ha dado.
 */
export function canUseGenerator({ isGM, isOwner, playersEnabled, actorType }) {
  if (!ACTOR_TYPES.includes(actorType)) return false;
  if (isGM) return true;
  return Boolean(playersEnabled && isOwner && actorType === "character");
}

/** Borrador vacío. */
export function emptyDraft() {
  return { schema: DRAFT_SCHEMA, method: null, step: "method", data: {}, rolls: [] };
}

/**
 * Normaliza un borrador leído de la bandera; si falta o es de otro esquema, devuelve uno vacío.
 * Se guarda como texto JSON: Foundry trata los puntos de las claves («g.style.c0») como rutas y al fusionar
 * objetos no borra claves viejas; un texto se sustituye entero. Se acepta también un objeto (0.1.0).
 */
export function normalizeDraft(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  if (!raw || typeof raw !== "object" || raw.schema !== DRAFT_SCHEMA) return emptyDraft();
  const d = { ...emptyDraft(), ...raw };
  if (!METHODS.includes(d.method)) d.method = null;
  if (!STEPS.includes(d.step)) d.step = "method";
  if (!d.method) d.step = "method";
  if (typeof d.data !== "object" || d.data === null) d.data = {};
  if (!Array.isArray(d.rolls)) d.rolls = [];
  return d;
}

/** Serializa el borrador para la bandera. */
export const serializeDraft = (draft) => JSON.stringify(draft);

/**
 * Permisos sobre un hueco que admite tirada:
 * - tirar: si está vacío; si ya tiene valor, el DJ siempre, con «Tirar o elegir» cualquiera, con «Solo tiradas» solo con permiso del DJ;
 * - elegir directamente: el DJ siempre; los demás solo con «Tirar o elegir»;
 * - pedir repetir: el jugador con «Solo tiradas», si ya está tirado y no tiene permiso concedido.
 */
export function rollRights({ answered, policy, isGM, granted }) {
  const free = policy === "free";
  const canRoll = !answered || isGM || free || Boolean(granted);
  return { canRoll, canChoose: isGM || free, canRequest: answered && !isGM && !free && !granted };
}

/** Paso siguiente o anterior (`dir` = 1 o −1); no sale de los límites ni avanza sin método. */
export function moveStep(draft, dir) {
  if (!draft.method) return "method";
  const i = STEPS.indexOf(draft.step);
  return STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))];
}
