// Generador paso 3: Rata callejera + vida pasada de punta a punta en el banco 30013, y repetición autorizada por el DJ.
// Uso: node tools/bench/gen03-rata-callejera.mjs <salida.json> <carpeta-capturas>
import { chromium } from "file:///E:/Users/odion/Desktop/project_developement/tmp/foundry-v12-browser/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:30013", out = process.argv[2], shots = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const R = { errors: [], steps: {} };
const step = (k, v) => { R.steps[k] = v; console.log(k, JSON.stringify(v).slice(0, 900)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(pick, lang = "es") {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => R.errors.push(e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") R.errors.push(`console: ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.users?.size > 0, null, { timeout: 90000 });
  await page.evaluate(async (pick) => { const u = game.users.find(new Function("x", `return ${pick}`)); await fetch("/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", userid: u.id, password: "" }) }); }, pick);
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/game`, { waitUntil: "load" });
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 180000 });
    await wait(3000);
    if (await page.evaluate((l) => game.i18n.lang === l, lang)) break;
    await page.evaluate((l) => game.settings.set("core", "language", l), lang);
  }
  return page;
}
// Helpers dentro del navegador: app del generador, clic por acción, elegir en un select.
const HELPERS = `
  window.__gen = (id) => foundry.applications.instances.get('cyberpunk-generador-' + id);
  window.__w = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__click = async (id, sel) => { const el = __gen(id).element.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); await __w(900); };
  window.__pick = async (id, sel, idx = 1) => { const s = __gen(id).element.querySelector(sel); if (!s) throw new Error('no ' + sel); s.selectedIndex = Math.min(idx, s.options.length - 1); s.dispatchEvent(new Event('change')); await __w(900); };
  window.__dialogYes = async () => { for (let i = 0; i < 20; i++) { const b = document.querySelector('.dialog .dialog-button.yes'); if (b) { b.click(); await __w(900); return true; } await __w(250); } return false; };
`;
try {
  const st = await (await fetch(`${BASE}/api/status`)).json();
  if (!st.active) { await fetch(`${BASE}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launchWorld", world: "edgerunners-2070-pruebas" }) }); for (let i = 0; i < 60; i++) { await wait(3000); if ((await (await fetch(`${BASE}/api/status`)).json()).active) break; } }
  const gm = await login("x.role === 4");
  await gm.evaluate(HELPERS);
  step("entorno", await gm.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, active: game.modules.get("cyberpunk-generador")?.active, lang: game.i18n.lang, motor: game.modules.get("edgerunners-2070")?.active, babele: game.modules.get("babele")?.active, tr: game.modules.get("cyberpunk-tr-esp")?.active })));
  const id = await gm.evaluate(async () => {
    await game.settings.set("cyberpunk-generador", "rollPolicy", "free");
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN3] ")).map((a) => a.id));
    const a = await Actor.implementation.create({ name: "[GEN3] Tecnomédica", type: "character" });
    game.modules.get("cyberpunk-generador").api.open(a); await __w(2000);
    return a.id;
  });
  // Método, rol, características.
  step("rol-y-caracteristicas", await gm.evaluate(async (id) => {
    await __click(id, '[data-method="streetrat"]');
    await __click(id, '[data-step="role"]');
    await __click(id, '[data-role="medtech"]');
    await __click(id, '[data-step="stats"]');
    const before = game.messages.size;
    await __click(id, '[data-action="rollSlot"][data-key="stats.row"]'); await __w(800);
    const msg = game.messages.contents.at(-1);
    const d = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft"));
    return { chat: game.messages.size - before, flavor: msg.flavor, total: msg.rolls[0]?.total, answer: d.data.answers["stats.row"], selectedRow: __gen(id).element.querySelector(".cprgen-table tr.selected td")?.textContent };
  }, id));
  await gm.screenshot({ path: `${shots}/gen03-caracteristicas.png` });
  // Habilidades: especialidad de Ciencia e idioma de origen.
  step("habilidades", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="skills"]');
    await __pick(id, 'select[data-key="spec.Ciencia (elige 1)"]', 2);
    await __pick(id, 'select[data-key="lang.origin"]', 3);
    const d = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft"));
    return { spec: d.data.answers["spec.Ciencia (elige 1)"], lang: d.data.answers["lang.origin"], rows: __gen(id).element.querySelectorAll(".cprgen-skills tr").length };
  }, id));
  await gm.screenshot({ path: `${shots}/gen03-habilidades.png` });
  // Vida pasada: rellenar todos los huecos (tirar donde se puede; elegir en las decisiones). Recuentos de enemigos forzados a 1.
  step("vida-pasada", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="lifepath"]');
    let rolls = 0, picks = 0;
    for (let i = 0; i < 120; i++) {
      const el = __gen(id).element;
      const empty = el.querySelector(".cprgen-slot.empty");
      if (!empty) break;
      const sel = empty.querySelector("select[data-key]");
      const key = sel?.dataset.key ?? empty.querySelector("[data-key]")?.dataset.key;
      if (key === "g.enemies.n") { await __pick(id, 'select[data-key="g.enemies.n"]', 2); picks++; continue; } // 1 enemigo
      const btn = empty.querySelector('[data-action="rollSlot"]');
      if (btn) { btn.click(); await __w(900); rolls++; }
      else { sel.selectedIndex = 1; sel.dispatchEvent(new Event("change")); await __w(900); picks++; }
    }
    const el = __gen(id).element;
    return { rolls, picks, empty: el.querySelectorAll(".cprgen-slot.empty").length, progress: el.querySelector(".cprgen-body > p strong")?.textContent, groups: [...el.querySelectorAll(".cprgen-group legend")].map((l) => l.textContent) };
  }, id));
  await gm.screenshot({ path: `${shots}/gen03-vida-pasada.png` });
  // Equipo: elegir la segunda opción en cada línea con opciones.
  step("equipo", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="gear"]');
    const n = __gen(id).element.querySelectorAll("select[data-key^='gear.']").length;
    for (let i = 0; i < n; i++) {
      const s = [...__gen(id).element.querySelectorAll("select[data-key^='gear.']")][i];
      await __pick(id, `select[data-key="${s.dataset.key}"]`, 2);
    }
    return { choices: n, lines: __gen(id).element.querySelectorAll(".cprgen-line").length };
  }, id));
  await gm.screenshot({ path: `${shots}/gen03-equipo.png` });
  // Revisión y aplicación.
  step("revision", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="review"]');
    const el = __gen(id).element;
    return { missing: [...el.querySelectorAll(".cprgen-body li")].map((l) => l.textContent), summary: [...el.querySelectorAll(".cprgen-summary dd")].map((d) => d.textContent.slice(0, 120)) };
  }, id));
  await gm.screenshot({ path: `${shots}/gen03-revision.png` });
  step("aplicar", await gm.evaluate(async (id) => {
    await __click(id, '[data-action="applySheet"]');
    await __dialogYes(); await __w(6000);
    const a = game.actors.get(id), s = a.system;
    const skill = (n) => a.itemTypes.skill.find((i) => i.name === n)?.system.level;
    const role = a.itemTypes.role[0];
    const cw = a.itemTypes.cyberware.filter((c) => !c.system.core);
    return {
      stats: Object.fromEntries(Object.entries(s.stats).map(([k, v]) => [k, v.value])),
      hp: s.derivedStats.hp, humanity: { value: s.derivedStats.humanity.value, max: s.derivedStats.humanity.max },
      skills: { Paramedic: skill("Paramedic"), ShoulderArms: skill("Shoulder Arms"), Athletics: skill("Athletics"), Cybertech: skill("Cybertech") },
      extraSkills: a.itemTypes.skill.filter((i) => i.system.level > 0 && !i.system.core).map((i) => `${i.name}:${i.system.level}`),
      role: role ? { name: role.name, rank: role.system.rank, active: s.roleInfo.activeRole } : null,
      items: Object.fromEntries(["weapon", "armor", "ammo", "gear", "clothing", "cyberware", "program"].map((t) => [t, a.itemTypes[t]?.length ?? 0])),
      cyber: cw.map((c) => `${c.name}:${c.system.isInstalled}`),
      equipped: [...a.itemTypes.weapon, ...a.itemTypes.armor].map((i) => `${i.name}:${i.system.equipped}`),
      wealth: s.wealth.value, ledger: s.wealth.transactions.at(-1),
      lifestyle: [s.lifestyle.housing.description, s.lifestyle.housing.cost, s.lifestyle.lifeStyle.description, s.lifestyle.lifeStyle.cost],
      lifepath: Object.fromEntries(Object.entries(s.lifepath).map(([k, v]) => [k, (v ?? "").replace(/<[^>]+>/g, " ").trim().slice(0, 70)])),
      applied: Boolean(JSON.parse(a.getFlag("cyberpunk-generador", "draft")).appliedAt),
      chatLog: game.messages.contents.at(-1)?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600),
    };
  }, id));
  await gm.evaluate(async (id) => { game.actors.get(id).sheet.render(true); await __w(2500); }, id);
  await gm.screenshot({ path: `${shots}/gen03-ficha.png` });
  // Jugador con «Solo tiradas»: tirada bloqueada, petición, autorización del DJ y repetición.
  const pid = await gm.evaluate(async () => {
    for (const w of Object.values(ui.windows)) await w.close();
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    await game.settings.set("cyberpunk-generador", "rollPolicy", "rollsOnly");
    const player = game.users.find((u) => !u.isGM);
    const a = await Actor.implementation.create({ name: "[GEN3] Jugador", type: "character", ownership: { default: 0, [player.id]: 3 } });
    return a.id;
  });
  const pl = await login("!x.isGM");
  await pl.evaluate(HELPERS);
  step("jugador-solo-tiradas", await pl.evaluate(async (id) => {
    game.modules.get("cyberpunk-generador").api.open(game.actors.get(id)); await __w(2000);
    await __click(id, '[data-method="streetrat"]');
    await __click(id, '[data-step="role"]');
    await __click(id, '[data-role="solo"]');
    await __click(id, '[data-step="stats"]');
    const el0 = __gen(id).element;
    const selectBefore = Boolean(el0.querySelector('select[data-key="stats.row"]'));
    await __click(id, '[data-action="rollSlot"][data-key="stats.row"]');
    const first = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft")).data.answers["stats.row"];
    const el = __gen(id).element;
    const rerollBtn = Boolean(el.querySelector('[data-action="rollSlot"][data-key="stats.row"]'));
    const requestBtn = Boolean(el.querySelector('[data-action="requestReroll"][data-key="stats.row"]'));
    await __click(id, '[data-action="requestReroll"][data-key="stats.row"]');
    return { selectBefore, first, rerollBtn, requestBtn };
  }, pid));
  step("dj-autoriza", await gm.evaluate(async () => ({ dialog: await __dialogYes() })));
  await wait(2000);
  step("jugador-repite", await pl.evaluate(async (id) => {
    const el = __gen(id).element;
    const canRoll = Boolean(el.querySelector('[data-action="rollSlot"][data-key="stats.row"]'));
    if (canRoll) await __click(id, '[data-action="rollSlot"][data-key="stats.row"]');
    const d = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft"));
    const after = __gen(id).element;
    return { canRoll, rolls: d.rolls.length, grantLeft: Boolean(d.data.grants?.["stats.row"]), lockedAgain: !after.querySelector('[data-action="rollSlot"][data-key="stats.row"]'), whisper: game.messages.contents.filter((m) => /permite/.test(m.content)).length };
  }, pid));
  await pl.screenshot({ path: `${shots}/gen03-jugador.png` });
  // Limpieza.
  await gm.evaluate(async () => {
    await game.settings.set("cyberpunk-generador", "rollPolicy", "free");
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    for (const w of Object.values(ui.windows)) await w.close();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN3] ")).map((a) => a.id));
  });
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
