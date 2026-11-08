// Generador paso 1: activación, ajustes, botones, asistente, permisos (DJ y jugador). Banco 30013.
import { chromium } from "file:///E:/Users/odion/Desktop/project_developement/tmp/foundry-v12-browser/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:30013", out = process.argv[2], shots = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const R = { errors: [], steps: {} };
const step = (k, v) => { R.steps[k] = v; console.log(k, JSON.stringify(v).slice(0, 700)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(pick) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => R.errors.push(e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error" && /cprgen|cyberpunk-generador/i.test(m.text())) R.errors.push(m.text().slice(0, 300)); });
  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.users?.size > 0, null, { timeout: 90000 });
  await page.evaluate(async (pick) => { const u = game.users.find(new Function("x", `return ${pick}`)); await fetch("/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", userid: u.id, password: "" }) }); }, pick);
  await page.goto(`${BASE}/game`, { waitUntil: "load" });
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 180000 });
  await wait(3000);
  return page;
}
try {
  const st = await (await fetch(`${BASE}/api/status`)).json();
  if (!st.active) { await fetch(`${BASE}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launchWorld", world: "edgerunners-2070-pruebas" }) }); for (let i = 0; i < 60; i++) { await wait(3000); if ((await (await fetch(`${BASE}/api/status`)).json()).active) break; } }
  let gm = await login("x.role === 4");
  const active = await gm.evaluate(() => game.modules.get("cyberpunk-generador")?.active);
  if (!active) {
    await gm.evaluate(async () => { const c = game.settings.get("core", "moduleConfiguration"); c["cyberpunk-generador"] = true; await game.settings.set("core", "moduleConfiguration", c); });
    await wait(1500); await gm.close(); gm = await login("x.role === 4");
  }
  step("entorno", await gm.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, active: game.modules.get("cyberpunk-generador")?.active, lang: game.i18n.lang, users: game.users.map((u) => `${u.name}:${u.role}`), policy: game.settings.get("cyberpunk-generador", "rollPolicy"), players: game.settings.get("cyberpunk-generador", "playersEnabled"), api: typeof game.modules.get("cyberpunk-generador").api?.open })));
  // Botón del directorio (DJ).
  await gm.evaluate(() => ui.sidebar.activateTab("actors")); await wait(800);
  step("directorio-DJ", await gm.evaluate(() => ({ button: document.querySelector("#actors .cprgen-new")?.innerText.trim() ?? null })));
  // Actores de prueba: uno del jugador, uno ajeno, un contenedor.
  const ids = await gm.evaluate(async () => {
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN] ")).map((a) => a.id));
    const player = game.users.find((u) => !u.isGM);
    const own = await Actor.create({ name: "[GEN] Propio", type: "character", ownership: { default: 0, [player.id]: 3 } });
    const other = await Actor.create({ name: "[GEN] Ajeno", type: "character", ownership: { default: 2 } });
    const mook = await Actor.create({ name: "[GEN] Secuaz", type: "mook" });
    return { own: own.id, other: other.id, mook: mook.id, player: player.name };
  });
  step("actores", ids);
  // Botón de cabecera para el DJ y asistente.
  step("asistente-DJ", await gm.evaluate(async (ids) => {
    const a = game.actors.get(ids.own); a.sheet.render(true); await new Promise((r) => setTimeout(r, 2000));
    const header = Boolean(a.sheet.element?.[0]?.querySelector(".header-button.cprgen-open, a.cprgen-open"));
    a.sheet.element[0].querySelector(".cprgen-open").click(); await new Promise((r) => setTimeout(r, 1500));
    const app = foundry.applications.instances.get(`cyberpunk-generador-${ids.own}`);
    const el = app?.element;
    const steps = [...el.querySelectorAll(".cprgen-step")].map((b) => `${b.innerText.trim()}${b.disabled ? "(bloq)" : ""}`);
    el.querySelector('[data-method="streetrat"]').click(); await new Promise((r) => setTimeout(r, 1200));
    const afterMethod = a.getFlag("cyberpunk-generador", "draft");
    app.element.querySelector('[data-action="next"]').click(); await new Promise((r) => setTimeout(r, 1200));
    const mookHeader = (() => { const m = game.actors.get(ids.mook); return m; })();
    return { header, title: app.title, steps, methods: el.querySelectorAll(".cprgen-method").length, afterMethod, stepAfterNext: a.getFlag("cyberpunk-generador", "draft").step, pending: app.element.querySelector(".cprgen-pending")?.innerText ?? null };
  }, ids));
  await gm.screenshot({ path: `${shots}/gen01-dj.png` });
  // Jugador.
  const pl = await login("!x.isGM");
  step("jugador", await pl.evaluate(async (ids) => {
    const own = game.actors.get(ids.own), other = game.actors.get(ids.other);
    own.sheet.render(true); await new Promise((r) => setTimeout(r, 2000));
    const ownBtn = Boolean(own.sheet.element?.[0]?.querySelector(".cprgen-open"));
    other.sheet.render(true); await new Promise((r) => setTimeout(r, 2000));
    const otherBtn = Boolean(other.sheet.element?.[0]?.querySelector(".cprgen-open"));
    const dirBtn = Boolean(document.querySelector("#actors .cprgen-new"));
    // Abrir por la API sobre la ajena: debe negarse.
    game.modules.get("cyberpunk-generador").api.open(other);
    const otherApp = Boolean(foundry.applications.instances.get(`cyberpunk-generador-${ids.other}`));
    // Abrir la propia: ve el progreso del DJ (paso «Rol») y puede volver atrás.
    own.sheet.element[0].querySelector(".cprgen-open").click(); await new Promise((r) => setTimeout(r, 1500));
    const app = foundry.applications.instances.get(`cyberpunk-generador-${ids.own}`);
    const seenStep = app.element.querySelector(".cprgen-step.current")?.innerText.trim();
    const resetVisible = Boolean(app.element.querySelector(".cprgen-reset"));
    app.element.querySelector('[data-action="prev"]').click(); await new Promise((r) => setTimeout(r, 1200));
    return { ownBtn, otherBtn, dirBtn, otherApp, seenStep, resetVisible, stepAfterPrev: own.getFlag("cyberpunk-generador", "draft").step };
  }, ids));
  await pl.screenshot({ path: `${shots}/gen01-jugador.png` });
  // El DJ ve el cambio del jugador sin hacer nada (redibujado por updateActor).
  await wait(1000);
  step("sincronia-DJ", await gm.evaluate((ids) => foundry.applications.instances.get(`cyberpunk-generador-${ids.own}`)?.element.querySelector(".cprgen-step.current")?.innerText.trim(), ids));
  // Ajuste de jugadores desactivado: el jugador pierde el botón.
  await gm.evaluate(() => game.settings.set("cyberpunk-generador", "playersEnabled", false)); await wait(1500);
  step("jugadores-desactivado", await pl.evaluate(async (ids) => { const a = game.actors.get(ids.own); await a.sheet.close(); a.sheet.render(true); await new Promise((r) => setTimeout(r, 2000)); return { btn: Boolean(a.sheet.element?.[0]?.querySelector(".cprgen-open")) }; }, ids));
  await gm.evaluate(() => game.settings.set("cyberpunk-generador", "playersEnabled", true));
  // Cambio de método con confirmación y reinicio (DJ).
  step("reinicio", await gm.evaluate(async (ids) => {
    const a = game.actors.get(ids.own); const app = foundry.applications.instances.get(`cyberpunk-generador-${ids.own}`);
    app.element.querySelector(".cprgen-reset").click(); await new Promise((r) => setTimeout(r, 1000));
    document.querySelector(".dialog .dialog-button.yes")?.click(); await new Promise((r) => setTimeout(r, 1200));
    return { flag: a.getFlag("cyberpunk-generador", "draft") ?? null, current: app.element.querySelector(".cprgen-step.current")?.innerText.trim() };
  }, ids));
  // Limpieza.
  await gm.evaluate(async () => { for (const w of Object.values(ui.windows)) await w.close(); for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close(); await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN] ")).map((a) => a.id)); });
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
