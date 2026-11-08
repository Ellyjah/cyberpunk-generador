/**
 * Asistente de creación. El estado vive en la bandera `draft` del actor (texto JSON, ver logic/core.js), así que:
 * - se puede cerrar y retomar;
 * - el DJ y el jugador propietario ven el mismo progreso (se redibuja al actualizarse la bandera);
 * - nada se escribe en la ficha de RED hasta «Aplicar a la ficha» en el paso «Revisión».
 * Paso 3 (0.2.0): método Rata callejera completo y vida pasada para todos los métodos.
 */
import { MODULE_ID, METHODS, STEPS, canUseGenerator, normalizeDraft, serializeDraft, moveStep, rollRights } from "./logic/core.js";
import { lifepathSlots, slotTable, rowText, rowForTotal, countFromTotal, missingSlots } from "./logic/lifepath.js";
import { gearChoices, specialtyChoices, missingStreetrat, cap } from "./logic/streetrat.js";
import { setting } from "./settings.js";
import { loadData, packChoices } from "./data.js";
import { rollToChat } from "./rolls.js";
import { gmExec, registerHandler } from "./socket.js";
import { buildPlan, applyPlan, markApplied } from "./apply.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});
// foundry.utils.escapeHTML no existe en V12.
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const IMPLEMENTED = { streetrat: ["role", "stats", "skills", "lifepath", "gear", "review"], edgerunner: ["role", "lifepath"], complete: ["role", "lifepath"] };

export function userCanUse(user, actor) {
  return canUseGenerator({ isGM: user.isGM, isOwner: actor.testUserPermission(user, "OWNER"), playersEnabled: setting("playersEnabled"), actorType: actor.type });
}

export function openGenerator(actor) {
  if (!actor || !userCanUse(game.user, actor)) return ui.notifications.warn(L("denied"));
  const id = `${MODULE_ID}-${actor.id}`;
  const open = foundry.applications.instances.get(id);
  if (open) return open.render({ force: true });
  return new GeneratorWizard({ id, actor }).render({ force: true });
}

// Petición de repetir tirada (política «Solo tiradas»): la decide el DJ activo y la concede en el borrador.
registerHandler("rerollRequest", async ({ actorId, key, label }, userId) => {
  const user = game.users.get(userId), actor = game.actors.get(actorId);
  if (!user || !actor || !actor.testUserPermission(user, "OWNER") || typeof key !== "string") return;
  const ok = await Dialog.confirm({ title: L("reroll.title"), content: `<p>${L("reroll.ask", { user: user.name, actor: actor.name, what: esc(String(label ?? key)) })}</p>` });
  const draft = normalizeDraft(actor.getFlag(MODULE_ID, "draft"));
  if (ok) {
    draft.data.grants = { ...(draft.data.grants ?? {}), [key]: true };
    await actor.setFlag(MODULE_ID, "draft", serializeDraft(draft));
  }
  ChatMessage.create({ content: L(ok ? "reroll.granted" : "reroll.denied", { user: user.name, what: esc(String(label ?? key)) }), whisper: [userId, game.user.id] });
});

export class GeneratorWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static isCprGenerator = true;

  static DEFAULT_OPTIONS = {
    classes: ["cprgen", "cprgen-wizard"],
    window: { icon: "fas fa-user-plus", resizable: true },
    position: { width: 780, height: 700 },
    actions: {
      selectMethod: GeneratorWizard.#onSelectMethod,
      selectRole: GeneratorWizard.#onSelectRole,
      goStep: GeneratorWizard.#onGoStep,
      next: GeneratorWizard.#onNext,
      prev: GeneratorWizard.#onPrev,
      resetDraft: GeneratorWizard.#onReset,
      rollSlot: GeneratorWizard.#onRollSlot,
      requestReroll: GeneratorWizard.#onRequestReroll,
      applySheet: GeneratorWizard.#onApply,
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

  async writeDraft(draft) { await this.actor.setFlag(MODULE_ID, "draft", serializeDraft(draft)); }
  async saveDraft(patch) { await this.writeDraft({ ...this.draft, ...patch }); }
  async setAnswer(key, value, extra = {}) {
    const d = this.draft;
    d.data.answers = { ...(d.data.answers ?? {}), [key]: value };
    if (d.data.grants?.[key]) { d.data.grants = { ...d.data.grants }; delete d.data.grants[key]; }
    Object.assign(d, extra);
    await this.writeDraft(d);
  }

  /** Hueco renderizable: valor actual, opciones y permisos. */
  slotView(key, label, answer, options, { canRollSlot = true } = {}) {
    const d = this.draft;
    const answered = answer !== undefined && answer !== null;
    const r = rollRights({ answered, policy: setting("rollPolicy"), isGM: game.user.isGM, granted: d.data.grants?.[key] });
    return { key, label, answered, options, canRoll: canRollSlot && r.canRoll, canChoose: r.canChoose, canRequest: canRollSlot && r.canRequest, rolled: answer?.total !== undefined ? answer.total : null };
  }

  async _prepareContext() {
    const draft = this.draft;
    const data = await loadData();
    const index = STEPS.indexOf(draft.step);
    const answers = draft.data.answers ?? {};
    const role = draft.data.role ? data.role(draft.data.role) : null;
    const implemented = IMPLEMENTED[draft.method] ?? [];
    const ctx = {
      actor: this.actor, draft, isGM: game.user.isGM,
      policy: L(`settings.rollPolicy.${setting("rollPolicy")}`),
      methods: METHODS.map((m) => ({ id: m, label: L(`method.${m}.label`), hint: L(`method.${m}.hint`), selected: draft.method === m })),
      steps: STEPS.map((s, i) => ({ id: s, n: i + 1, label: L(`step.${s}`), current: s === draft.step, done: i < index, locked: !draft.method && s !== "method" })),
      stepLabel: L(`step.${draft.step}`), methodLabel: draft.method ? L(`method.${draft.method}.label`) : "",
      canPrev: index > 0, canNext: Boolean(draft.method) && index < STEPS.length - 1,
      step: { [draft.step]: true },
      pending: draft.step !== "method" && !implemented.includes(draft.step),
      needRole: ["stats", "skills", "lifepath", "gear", "review"].includes(draft.step) && !role,
      role,
    };
    if (ctx.pending || ctx.needRole) return ctx;
    if (draft.step === "role") ctx.roles = data.roles.map((r) => ({ key: r.key, name: r.name, selected: r.key === draft.data.role }));
    if (draft.step === "stats") ctx.stats = this.statsContext(role, answers);
    if (draft.step === "skills") ctx.skills = await this.skillsContext(role, answers, data);
    if (draft.step === "lifepath") ctx.lifepath = this.lifepathContext(role, answers, data);
    if (draft.step === "gear") ctx.gear = this.gearContext(role, answers);
    if (draft.step === "review") ctx.review = this.reviewContext(role, answers, data, draft);
    return ctx;
  }

  statsContext(role, answers) {
    const a = answers["stats.row"];
    const rows = role.statTable.map((row, i) => ({ value: i, label: `${i + 1}: ${STAT_KEYS.map((k) => row[k]).join(" · ")}`, selected: a?.row === i }));
    const slot = this.slotView("stats.row", L("stats.row"), a, rows);
    Object.assign(slot, { kind: "row", die: "1d10", text: a ? rows[a.row].label : "" });
    return {
      slot,
      header: STAT_KEYS.map((k) => L(`stat.${k}`)),
      table: role.statTable.map((row, i) => ({ n: i + 1, values: STAT_KEYS.map((k) => row[k]), selected: a?.row === i })),
    };
  }

  async skillsContext(role, answers, data) {
    const specs = [];
    for (const s of specialtyChoices(role.streetratSkills)) {
      const choices = await packChoices(s.pack);
      specs.push({ key: s.key, label: s.label, level: s.level, options: choices.map((c) => ({ value: c.uuid, label: c.name, selected: answers[s.key]?.uuid === c.uuid })) });
    }
    const langs = await packChoices("core_skills-languages");
    const region = data.lifepath.find((x) => x.id === "culturalOrigin");
    const ra = answers["g.culturalOrigin"];
    const lang = answers["lang.origin"];
    return {
      list: role.streetratSkills.map((s) => ({ label: s.label, level: s.level, spec: s.specialtyPack ? answers[`spec.${s.label}`]?.text ?? "" : "" })),
      specs,
      lang: {
        options: langs.map((c) => ({ value: c.uuid, label: c.name, selected: lang?.uuid === c.uuid })),
        other: lang && !lang.uuid ? lang.text : "",
        suggested: ra ? region.rows[ra.row].cells[1] : "",
        level: data.rules.cultureLanguageLevel,
      },
    };
  }

  lifepathContext(role, answers, data) {
    const slots = lifepathSlots(data.lifepath, role.lifepath, answers);
    const groups = [];
    for (const s of slots) {
      const groupLabel = s.group === "role" ? L("lifepath.roleGroup", { role: role.name }) : s.group;
      let g = groups.find((x) => x.label === groupLabel);
      if (!g) groups.push((g = { label: groupLabel, slots: [] }));
      const a = answers[s.key];
      let view;
      if (s.kind === "row") {
        const t = slotTable(s, data.lifepath, role.lifepath);
        const opts = t.rows.map((r, i) => ({ value: i, label: `${r.min === r.max ? r.min : `${r.min}-${r.max}`}: ${s.column !== undefined ? r.cells[s.column] : r.cells.join(" — ")}`, selected: a?.row === i }));
        view = this.slotView(s.key, s.label, a, opts);
        view.text = rowText(t, s, a);
        view.die = t.die;
      } else if (s.kind === "count") {
        view = this.slotView(s.key, L("lifepath.count", { formula: s.formula }), a, [0, 1, 2, 3].map((n) => ({ value: n, label: String(n), selected: a?.count === n })));
        view.text = a ? String(a.count) : "";
        view.die = s.formula;
      } else if (s.kind === "choice") {
        const opts = s.options.map((o) => ({ value: o.value, label: o.label, selected: a?.value === o.value }));
        view = this.slotView(s.key, s.label === "wronged" ? L("lifepath.wronged") : s.label, a, opts, { canRollSlot: false });
        view.canChoose = true; // las decisiones siempre se eligen (el libro no las tira)
        view.text = s.options.find((o) => o.value === a?.value)?.label ?? "";
      }
      view.kind = s.kind;
      g.slots.push(view);
    }
    const missing = missingSlots(slots, answers).length;
    return { groups, missing, total: slots.length, done: slots.length - missing };
  }

  gearContext(role, answers) {
    const choices = gearChoices(role);
    const lines = [];
    for (const cat of ["weapons", "gear", "cyberware"]) {
      role[cat].forEach((line, i) => {
        const key = `gear.${cat}.${i}`;
        if (line.clothing) return lines.push({ cat, text: line.text });
        const fmt = (o) => `${line.prefix ? `${line.prefix}: ` : ""}${cap(o.name)}${o.qty > 1 ? ` x${o.qty}` : ""}${o.note ? ` ${o.note}` : ""}`;
        if (line.options.length === 1) return lines.push({ cat, text: fmt(line.options[0]) });
        const a = answers[key];
        lines.push({ cat, key, choose: true, options: line.options.map((o, j) => ({ value: j, label: fmt(o), selected: a?.row === j })) });
      });
    }
    return {
      groups: ["weapons", "gear", "cyberware"].map((cat) => ({ label: L(`gear.${cat}`), lines: lines.filter((l) => l.cat === cat) })),
      humanity: L("gear.humanity", { loss: role.cyberwareHumanityLoss, emp: role.cyberwareEmpLoss }),
      pending: choices.filter((c) => !Number.isInteger(answers[c.key]?.row)).length,
    };
  }

  reviewContext(role, answers, data, draft) {
    const slots = lifepathSlots(data.lifepath, role.lifepath, answers);
    const missLp = missingSlots(slots, answers);
    const missSr = missingStreetrat(role, answers);
    const missing = [...missSr.map((k) => L(`review.missing.${k.split(".")[0]}`, { key: k.split(".").slice(1).join(".") })), ...(missLp.length ? [L("review.missing.lifepath", { n: missLp.length })] : [])];
    const ctx = { missing, ready: missing.length === 0, applied: draft.appliedAt ? new Date(draft.appliedAt).toLocaleString(game.i18n.lang) : null };
    if (ctx.ready) {
      const plan = buildPlan(data, draft);
      ctx.summary = {
        role: role.name, stats: STAT_KEYS.map((k) => `${L(`stat.${k}`)} ${plan.stats[k]}`).join(" · "),
        skills: plan.skills.map((s) => `${s.text ?? s.label} ${s.level}`).join(", "),
        items: plan.items.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ""}`).join(", "),
        clothing: plan.clothing.map((c) => `${c.text}${c.qty > 1 ? ` x${c.qty}` : ""}`).join(", "),
        money: plan.money, housing: `${plan.housing.housing.description} · ${plan.housing.lifestyle.description}`,
      };
    }
    return ctx;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    el.querySelectorAll("select[data-key]").forEach((s) => s.addEventListener("change", (ev) => this.#onChooseSlot(ev)));
    el.querySelectorAll("input[data-text-key]").forEach((i) => i.addEventListener("change", (ev) => this.#onTextSlot(ev)));
  }

  async close(options) {
    Hooks.off("updateActor", this._hook);
    return super.close(options);
  }

  /** Elección directa en un desplegable: fila, recuento, decisión, especialidad, idioma u opción de equipo. */
  async #onChooseSlot(ev) {
    const sel = ev.currentTarget, key = sel.dataset.key, kind = sel.dataset.kind, v = sel.value;
    if (v === "") return;
    if (kind === "count") return this.setAnswer(key, { count: Number(v) });
    if (kind === "choice") return this.setAnswer(key, { value: v });
    if (kind === "uuid") return this.setAnswer(key, { uuid: v, text: sel.selectedOptions[0]?.textContent.trim() });
    return this.setAnswer(key, { row: Number(v) });
  }

  async #onTextSlot(ev) {
    const inp = ev.currentTarget, text = inp.value.trim();
    await this.setAnswer(inp.dataset.textKey, text ? { text } : null);
  }

  static async #onSelectMethod(_event, target) {
    const method = target.dataset.method;
    if (!METHODS.includes(method)) return;
    const draft = this.draft;
    if (draft.method && draft.method !== method) {
      const ok = await Dialog.confirm({ title: L("method.changeTitle"), content: `<p>${L("method.changeBody")}</p>` });
      if (!ok) return;
      return this.writeDraft({ ...draft, method, step: "method", data: {} });
    }
    await this.saveDraft({ method });
  }

  static async #onSelectRole(_event, target) {
    const d = this.draft;
    if (d.data.role && d.data.role !== target.dataset.role) {
      const ok = await Dialog.confirm({ title: L("role.changeTitle"), content: `<p>${L("role.changeBody")}</p>` });
      if (!ok) return;
      // Cambiar de rol descarta lo que depende del rol; la vida pasada general se conserva.
      const kept = Object.fromEntries(Object.entries(d.data.answers ?? {}).filter(([k]) => k.startsWith("g.")));
      return this.writeDraft({ ...d, data: { ...d.data, role: target.dataset.role, answers: kept, grants: {} } });
    }
    await this.writeDraft({ ...d, data: { ...d.data, role: target.dataset.role } });
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

  /** Tirada de un hueco: características (1d10 → fila), tabla de vida pasada o recuento (1d10-7). */
  static async #onRollSlot(_event, target) {
    const key = target.dataset.key;
    const data = await loadData();
    const d = this.draft, answers = d.data.answers ?? {};
    const role = data.role(d.data.role);
    const r = rollRights({ answered: answers[key] != null, policy: setting("rollPolicy"), isGM: game.user.isGM, granted: d.data.grants?.[key] });
    if (!r.canRoll) return ui.notifications.warn(L("reroll.locked"));
    const record = (total, extra = {}) => ({ rolls: [...(d.rolls ?? []), { key, total, user: game.user.id, at: Date.now(), ...extra }] });
    if (key === "stats.row") {
      const total = await rollToChat(this.actor, "1d10", L("chat.stats", { role: role.name }));
      return this.setAnswer(key, { row: total - 1, total }, record(total));
    }
    const slot = lifepathSlots(data.lifepath, role.lifepath, answers).find((s) => s.key === key);
    if (!slot) return;
    if (slot.kind === "count") {
      const total = await rollToChat(this.actor, "1d10", L("chat.count", { what: slot.label, formula: slot.formula }));
      return this.setAnswer(key, { count: countFromTotal(slot.formula, total), total }, record(total));
    }
    const t = slotTable(slot, data.lifepath, role.lifepath);
    const total = await rollToChat(this.actor, t.die, `${t.title}${slot.column !== undefined ? ` — ${slot.label}` : ""}`);
    const row = rowForTotal(t, total);
    await this.setAnswer(key, { row, total }, record(total));
  }

  static async #onRequestReroll(_event, target) {
    await gmExec("rerollRequest", { actorId: this.actor.id, key: target.dataset.key, label: target.dataset.label });
    ui.notifications.info(L("reroll.sent"));
  }

  static async #onApply() {
    const d = this.draft;
    const data = await loadData();
    if (d.appliedAt) {
      const again = await Dialog.confirm({ title: L("apply.againTitle"), content: `<p>${L("apply.againBody")}</p>` });
      if (!again) return;
    } else {
      const ok = await Dialog.confirm({ title: L("apply.title"), content: `<p>${L("apply.body")}</p>` });
      if (!ok) return;
    }
    try {
      const log = await applyPlan(this.actor, buildPlan(data, d));
      await this.writeDraft(markApplied(this.draft));
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<p><strong>${L("apply.done")}</strong></p><ul>${log.map((l) => `<li>${l}</li>`).join("")}</ul>` });
      ui.notifications.info(L("apply.done"));
    } catch (err) {
      console.error(`${MODULE_ID} |`, err);
      ui.notifications.error(L("apply.error", { msg: err.message }));
    }
  }
}
