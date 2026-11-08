// Generador paso 6 (0.5.0) en el banco 30013: 10 fichas del libro, menú, encuentro aleatorio y PNJ rápidos por rol.
// Uso: node tools/bench/gen06-pnj.mjs <salida.json> <carpeta-capturas>
import { chromium } from "file:///E:/Users/odion/Desktop/project_developement/tmp/foundry-v12-browser/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:30013", out = process.argv[2], shots = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const R = { errors: [], steps: {} };
const step = (k, v) => { R.steps[k] = v; console.log(k, JSON.stringify(v).slice(0, 1200)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const st = await (await fetch(`${BASE}/api/status`)).json();
  if (!st.active) { await fetch(`${BASE}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launchWorld", world: "edgerunners-2070-pruebas" }) }); for (let i = 0; i < 60; i++) { await wait(3000); if ((await (await fetch(`${BASE}/api/status`)).json()).active) break; } }
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  page.on("pageerror", (e) => R.errors.push(e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") R.errors.push(`console: ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.users?.size > 0, null, { timeout: 90000 });
  await page.evaluate(async () => { const u = game.users.find((x) => x.role === 4); await fetch("/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", userid: u.id, password: "" }) }); });
  for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/game`, { waitUntil: "load" }); await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 180000 }); await wait(3000); if (await page.evaluate(() => game.i18n.lang === "es")) break; await page.evaluate(() => game.settings.set("core", "language", "es")); }
  await page.evaluate(() => { window.__w = (ms) => new Promise((r) => setTimeout(r, ms)); });
  step("entorno", await page.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, api: Object.keys(game.modules.get("cyberpunk-generador").api) })));
  // Limpieza previa.
  await page.evaluate(async () => {
    const f = game.folders.find((x) => x.type === "Actor" && x.name === game.i18n.localize("CPRGEN.npc.folder"));
    if (f) await Actor.deleteDocuments(f.contents.map((a) => a.id));
  });
  // 1) Las 10 fichas del libro.
  step("fichas", await page.evaluate(async () => {
    const npcs = (await (await fetch("modules/cyberpunk-generador/data/npcs.json")).json()).npcs;
    const api = game.modules.get("cyberpunk-generador").api;
    const out = {};
    for (const n of npcs) {
      const a = await api.createBookNpc(n, { name: `[GEN6] ${n.name}`, type: "mook" });
      const s = a.system, lvl = (x) => a.itemTypes.skill.find((i) => i.name === x)?.system.level;
      const cw = a.itemTypes.cyberware.filter((c) => !c.system.core);
      out[n.key] = {
        type: a.type, stats: Object.values(s.stats).map((v) => v.value).join(","), hp: `${s.derivedStats.hp.value}/${s.derivedStats.hp.max}`,
        handgun: lvl("Handgun"), brawl: lvl("Brawling"), role: a.itemTypes.role.map((r) => `${r.name}:${r.system.rank}`).join(),
        weapons: a.itemTypes.weapon.map((w) => `${w.name}:${w.system.equipped}`), armor: a.itemTypes.armor.map((w) => `${w.name}:${w.system.equipped}`),
        cyber: cw.map((c) => `${c.name}:${c.system.isInstalled}${c.system.installedItems?.list?.length ? `[${c.system.installedItems.list.length}]` : ""}`),
        ammo: a.itemTypes.ammo.map((i) => `${i.name}:${i.system.amount}`), gear: a.itemTypes.gear.length, programs: a.itemTypes.program.length,
        extraSkills: a.itemTypes.skill.filter((i) => !i.system.core).map((i) => `${i.name}:${i.system.level}`),
        notes: s.information.notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
      };
    }
    return out;
  }));
  // Ficha del ciberpsicópata abierta, para la captura.
  await page.evaluate(async () => { game.actors.getName("[GEN6] Ciberpsicópata")?.sheet.render(true); await __w(2500); });
  await page.screenshot({ path: `${shots}/gen06-ciberpsicopata.png` });
  await page.evaluate(async () => { for (const w of Object.values(ui.windows)) await w.close(); });
  // 2) Menú del directorio.
  step("menu", await page.evaluate(async () => {
    ui.sidebar.activateTab("actors"); await __w(800);
    document.querySelector("#actors .cprgen-new").click(); await __w(1200);
    const d = document.querySelector(".cprgen-menu");
    const buttons = [...(d?.querySelectorAll(".dialog-button") ?? [])].map((b) => b.textContent.trim());
    return { buttons };
  }));
  await page.screenshot({ path: `${shots}/gen06-menu.png` });
  // 3) Encuentro aleatorio desde el menú (tabla de medianoche).
  step("encuentro", await page.evaluate(async () => {
    [...document.querySelectorAll(".cprgen-menu .dialog-button")].find((b) => /Encuentro/.test(b.textContent)).click(); await __w(1200);
    const sel = document.querySelector(".dialog select[name=table]"); sel.value = "midnight";
    const before = game.actors.size, msgs = game.messages.size;
    [...document.querySelectorAll(".dialog .dialog-button")].pop().click(); await __w(2500);
    const dlg = [...document.querySelectorAll(".dialog")].pop();
    const title = dlg?.querySelector(".window-title")?.textContent;
    const checks = dlg?.querySelectorAll("input[name=use]").length ?? 0;
    const roll = game.messages.contents.slice(msgs).map((m) => ({ whisper: m.whisper.length, blind: m.blind, content: (m.flavor || m.content).replace(/<[^>]+>/g, " ").slice(0, 120) }));
    dlg.querySelector(".dialog-button").click(); await __w(checks ? 6000 : 800);
    const created = game.actors.contents.slice(before).map((a) => ({ name: a.name, folder: a.folder?.name, notes: a.system.information.notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 140) }));
    return { title, checks, roll, created };
  }));
  // 4) PNJ rápidos por rol.
  step("rapidos", await page.evaluate(async () => {
    const api = game.modules.get("cyberpunk-generador").api;
    const before = game.messages.size;
    const a = await api.createQuickNpc("netrunner", { name: "[GEN6] Netrunner rápida", type: "mook", lifepath: true });
    const b = await api.createQuickNpc("solo", { name: "[GEN6] Mercenario rápido", type: "character", lifepath: false });
    const info = (x) => ({ type: x.type, role: x.itemTypes.role.map((r) => `${r.name}:${r.system.rank}`).join(), stats: Object.values(x.system.stats).map((v) => v.value).join(","),
      items: x.items.size, wealth: x.system.wealth?.value ?? null, lifepath: Object.values(x.system.lifepath ?? {}).filter((v) => v).length, notesLifepath: /<h2>/.test(x.system.information?.notes ?? ""), notesLen: (x.system.information?.notes ?? "").length, record: JSON.parse(x.getFlag("cyberpunk-generador", "applied")).method,
      cyber: x.itemTypes.cyberware.filter((c) => !c.system.core).map((c) => `${c.name}:${c.system.isInstalled}`), folder: x.folder?.name });
    const msgs = game.messages.contents.slice(before).map((m) => ({ whisper: m.whisper.length > 0, text: (m.flavor || m.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 60) }));
    return { netrunner: info(a), solo: info(b), publicMessages: msgs.filter((m) => !m.whisper).length, messages: msgs.length };
  }));
  await page.evaluate(async () => { game.actors.getName("[GEN6] Netrunner rápida")?.sheet.render(true); await __w(2500); });
  await page.screenshot({ path: `${shots}/gen06-rapido.png` });
  await page.evaluate(async () => {
    for (const w of Object.values(ui.windows)) await w.close();
    const f = game.folders.find((x) => x.type === "Actor" && x.name === game.i18n.localize("CPRGEN.npc.folder"));
    if (f) { await Actor.deleteDocuments(f.contents.map((a) => a.id)); await f.delete(); }
  });
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
