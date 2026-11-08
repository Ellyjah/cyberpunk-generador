// Generador paso 4: Edgerunner de punta a punta en el banco 30013 (tiradas por característica, 86 puntos, aplicación).
// Uso: node tools/bench/gen04-edgerunner.mjs <salida.json> <carpeta-capturas>
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
  step("entorno", await gm.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, lang: game.i18n.lang })));
  const id = await gm.evaluate(async () => {
    await game.settings.set("cyberpunk-generador", "rollPolicy", "free");
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN4] ")).map((a) => a.id));
    const a = await Actor.implementation.create({ name: "[GEN4] Mercenaria", type: "character" });
    game.modules.get("cyberpunk-generador").api.open(a); await __w(2000);
    return a.id;
  });
  step("caracteristicas", await gm.evaluate(async (id) => {
    await __click(id, '[data-method="edgerunner"]');
    await __click(id, '[data-step="role"]');
    await __click(id, '[data-role="solo"]');
    await __click(id, '[data-step="stats"]');
    const before = game.messages.size;
    const keys = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
    for (const k of keys) await __click(id, `[data-action="rollSlot"][data-key="stats.${k}"]`);
    const d = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft"));
    const role = (await (await fetch("modules/cyberpunk-generador/data/roles.json")).json()).find((r) => r.key === "solo");
    const ok = keys.every((k) => { const a = d.data.answers["stats." + k]; return a && a.row === a.total - 1; });
    return { chats: game.messages.size - before, ok, values: Object.fromEntries(keys.map((k) => [k, role.statTable[d.data.answers["stats." + k].row][k]])), flavors: game.messages.contents.slice(-2).map((m) => m.flavor), selectedCells: __gen(id).element.querySelectorAll("td.selected").length };
  }, id));
  await gm.screenshot({ path: `${shots}/gen04-caracteristicas.png` });
  step("habilidades", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="skills"]');
    const levels = { "Atletismo": 4, "Concentración": 2, "Conversación": 2, "Cultura": 4, "Evasión": 6, "Experto local (tu hogar)": 4, "Idioma (jerga callejera)": 4,
      "Pelea": 6, "Percepción": 6, "Percepción humana": 4, "Persuasión": 4, "Primeros auxilios": 4, "Sigilo": 6, "Arma cuerpo a cuerpo": 6, "Armas cortas": 4,
      "Armas largas": 4, "Disparo automático": 2, "Interrogatorio": 4, "Resistir torturas/drogas": 4, "Tácticas": 4 };
    const set = async (label, v) => { const i = __gen(id).element.querySelector(`input[data-skill-key="skill.${label}"]`); if (!i) throw new Error("sin input " + label); i.value = v; i.dispatchEvent(new Event("change")); await __w(700); };
    for (const [k, v] of Object.entries(levels)) await set(k, v);
    const counter = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    await set("Tácticas", 6);
    const over = { cls: __gen(id).element.querySelector(".cprgen-points").classList.contains("over"), text: __gen(id).element.querySelector(".cprgen-points").textContent.trim() };
    await __click(id, '[data-step="review"]');
    const reviewOver = [...__gen(id).element.querySelectorAll(".cprgen-body li")].map((l) => l.textContent);
    await __click(id, '[data-step="skills"]');
    await set("Tácticas", 4);
    await set("Atletismo", 9); // se recorta a 6
    const clamped = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft")).data.answers["skill.Atletismo"];
    await set("Atletismo", 4);
    await __pick(id, 'select[data-key="lang.origin"]', 5);
    return { counter, over, reviewOver, clamped, final: __gen(id).element.querySelector(".cprgen-points").textContent.trim(), x2: [...__gen(id).element.querySelectorAll(".cprgen-skills td:first-child")].filter((t) => /x2/.test(t.textContent)).map((t) => t.textContent) };
  }, id));
  await gm.screenshot({ path: `${shots}/gen04-habilidades.png` });
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
      if (key === "g.enemies.n") { await __pick(id, 'select[data-key="g.enemies.n"]', 1); picks++; continue; } // 1 enemigo
      const btn = empty.querySelector('[data-action="rollSlot"]');
      if (btn) { btn.click(); await __w(900); rolls++; }
      else { sel.selectedIndex = 1; sel.dispatchEvent(new Event("change")); await __w(900); picks++; }
    }
    const el = __gen(id).element;
    return { rolls, picks, empty: el.querySelectorAll(".cprgen-slot.empty").length, progress: el.querySelector(".cprgen-body > p strong")?.textContent, groups: [...el.querySelectorAll(".cprgen-group legend")].map((l) => l.textContent) };
  }, id));
  step("equipo", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="gear"]');
    const keys = [...__gen(id).element.querySelectorAll("select[data-key^='gear.']")].map((s) => s.dataset.key);
    for (const k of keys) await __pick(id, `select[data-key="${k}"]`, 1);
    return { choices: keys.length };
  }, id));
  step("revision", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="review"]');
    const el = __gen(id).element;
    return { missing: [...el.querySelectorAll(".cprgen-body li")].map((l) => l.textContent), summary: [...el.querySelectorAll(".cprgen-summary dd")].map((d) => d.textContent.slice(0, 160)) };
  }, id));
  await gm.screenshot({ path: `${shots}/gen04-revision.png` });
  step("aplicar", await gm.evaluate(async (id) => {
    await __click(id, '[data-action="applySheet"]');
    await __dialogYes(); await __w(6000);
    const a = game.actors.get(id), s = a.system;
    const lvl = (n) => a.itemTypes.skill.find((i) => i.name === n)?.system.level;
    return {
      stats: Object.fromEntries(Object.entries(s.stats).map(([k, v]) => [k, v.value])),
      skills: { Autofire: lvl("Autofire"), Evasion: lvl("Evasion"), Tactics: lvl("Tactics"), Concentration: lvl("Concentration"), Melee: lvl("Melee Weapon"), Education: lvl("Education") },
      extra: a.itemTypes.skill.filter((i) => !i.system.core && i.system.level > 0).map((i) => `${i.name}:${i.system.level}`),
      role: a.itemTypes.role.map((r) => `${r.name}:${r.system.rank}`), items: a.items.size, humanity: s.derivedStats.humanity.value, wealth: s.wealth.value,
      cyber: a.itemTypes.cyberware.filter((c) => !c.system.core).map((c) => `${c.name}:${c.system.isInstalled}`),
      chat: game.messages.contents.at(-1)?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400),
    };
  }, id));
  await gm.evaluate(async () => {
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN4] ")).map((a) => a.id));
  });
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
