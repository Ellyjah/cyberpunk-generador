import test from "node:test";
import assert from "node:assert/strict";
import { canUseGenerator, normalizeDraft, emptyDraft, moveStep, DRAFT_SCHEMA } from "../scripts/logic/core.js";

test("permisos: el DJ puede sobre personaje y secuaz; no sobre otros tipos", () => {
  assert.equal(canUseGenerator({ isGM: true, actorType: "character" }), true);
  assert.equal(canUseGenerator({ isGM: true, actorType: "mook" }), true);
  assert.equal(canUseGenerator({ isGM: true, actorType: "container" }), false);
});

test("permisos: jugador solo propietario, con el ajuste activo y en ficha de personaje", () => {
  const base = { isGM: false, isOwner: true, playersEnabled: true, actorType: "character" };
  assert.equal(canUseGenerator(base), true);
  assert.equal(canUseGenerator({ ...base, isOwner: false }), false);
  assert.equal(canUseGenerator({ ...base, playersEnabled: false }), false);
  assert.equal(canUseGenerator({ ...base, actorType: "mook" }), false);
});

test("borrador: vacío, esquema ajeno y valores inválidos se normalizan", () => {
  assert.deepEqual(normalizeDraft(undefined), emptyDraft());
  assert.deepEqual(normalizeDraft({ schema: 99, method: "complete" }), emptyDraft());
  const d = normalizeDraft({ schema: DRAFT_SCHEMA, method: "inventado", step: "gear", data: null, rolls: "x" });
  assert.equal(d.method, null); assert.equal(d.step, "method"); assert.deepEqual(d.data, {}); assert.deepEqual(d.rolls, []);
  assert.equal(normalizeDraft({ schema: DRAFT_SCHEMA, method: "edgerunner", step: "skills" }).step, "skills");
});

test("pasos: no se avanza sin método y no se sale de los límites", () => {
  assert.equal(moveStep({ method: null, step: "method" }, 1), "method");
  assert.equal(moveStep({ method: "streetrat", step: "method" }, 1), "role");
  assert.equal(moveStep({ method: "streetrat", step: "method" }, -1), "method");
  assert.equal(moveStep({ method: "streetrat", step: "review" }, 1), "review");
});
