/**
 * Asistente de creación. El estado vive en la bandera `draft` del actor, así que:
 * - se puede cerrar y retomar;
 * - el DJ y el jugador propietario ven el mismo progreso (se redibuja al actualizarse el actor);
 * - nada se escribe en la ficha de RED hasta el paso «Revisión» (paso 7 del plan).
 */
import { MODULE_ID, METHODS, STEPS, canUseGenerator, normalizeDraft, moveStep } from "./logic/core.js";
import { setting } from "./settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});

export function userCanUse(user, actor) {
  return canUseGenerator({
    isGM: user.isGM,
    isOwner: actor.testUserPermission(user, "OWNER"),
    playersEnabled: setting("playersEnabled"),
    actorType: actor.type,
  });
}

export function openGenerator(actor) {
  if (!actor || !userCanUse(game.user, actor)) return ui.notifications.warn(L("denied"));
  const id = `${MODULE_ID}-${actor.id}`;
  const open = foundry.applications.instances.get(id);
  if (open) return open.render({ force: true });
  return new GeneratorWizard({ id, actor }).render({ force: true });
}

export class GeneratorWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static isCprGenerator = true;

  static DEFAULT_OPTIONS = {
    classes: ["cprgen", "cprgen-wizard"],
    window: { icon: "fas fa-user-plus", resizable: true },
    position: { width: 720, height: 640 },
    actions: {
      selectMethod: GeneratorWizard.#onSelectMethod,
      goStep: GeneratorWizard.#onGoStep,
      next: GeneratorWizard.#onNext,
      prev: GeneratorWizard.#onPrev,
      resetDraft: GeneratorWizard.#onReset,
    },
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/wizard.hbs`, scrollable: [".cprgen-body"] } };

  constructor(options) {
    super(options);
    this.actor = options.actor;
    this._hook = Hooks.on("updateActor", (doc, change) => {
      if (doc.id === this.actor.id && foundry.utils.hasProperty(change, `flags.${MODULE_ID}`)) this.render();
    });
  }

  get title() { return L("wizard.title", { name: this.actor.name }); }

  get draft() { return normalizeDraft(this.actor.getFlag(MODULE_ID, "draft")); }

  async saveDraft(patch) {
    const draft = foundry.utils.mergeObject(this.draft, patch, { inplace: false });
    await this.actor.setFlag(MODULE_ID, "draft", draft);
  }

  async _prepareContext() {
    const draft = this.draft;
    const index = STEPS.indexOf(draft.step);
    return {
      actor: this.actor,
      draft,
      isGM: game.user.isGM,
      policy: L(`settings.rollPolicy.${setting("rollPolicy")}`),
      methods: METHODS.map((m) => ({ id: m, label: L(`method.${m}.label`), hint: L(`method.${m}.hint`), selected: draft.method === m })),
      steps: STEPS.map((s, i) => ({ id: s, n: i + 1, label: L(`step.${s}`), current: s === draft.step, done: i < index, locked: !draft.method && s !== "method" })),
      stepLabel: L(`step.${draft.step}`),
      isMethodStep: draft.step === "method",
      methodLabel: draft.method ? L(`method.${draft.method}.label`) : "",
      canPrev: index > 0,
      canNext: Boolean(draft.method) && index < STEPS.length - 1,
    };
  }

  async close(options) {
    Hooks.off("updateActor", this._hook);
    return super.close(options);
  }

  static async #onSelectMethod(_event, target) {
    const method = target.dataset.method;
    if (!METHODS.includes(method)) return;
    const draft = this.draft;
    // Cambiar de método descarta lo elegido con el anterior: las reglas de cada paso son distintas.
    if (draft.method && draft.method !== method) {
      const ok = await Dialog.confirm({ title: L("method.changeTitle"), content: `<p>${L("method.changeBody")}</p>` });
      if (!ok) return;
      return this.actor.setFlag(MODULE_ID, "draft", { ...draft, method, step: "method", data: {} });
    }
    await this.saveDraft({ method });
  }

  static async #onGoStep(_event, target) {
    const step = target.dataset.step;
    if (!STEPS.includes(step) || (!this.draft.method && step !== "method")) return;
    await this.saveDraft({ step });
  }

  static async #onNext() { await this.saveDraft({ step: moveStep(this.draft, 1) }); }
  static async #onPrev() { await this.saveDraft({ step: moveStep(this.draft, -1) }); }

  static async #onReset() {
    const ok = await Dialog.confirm({ title: L("wizard.resetTitle"), content: `<p>${L("wizard.resetBody")}</p>` });
    if (ok) await this.actor.unsetFlag(MODULE_ID, "draft");
  }
}
