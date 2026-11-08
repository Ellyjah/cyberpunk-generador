// Generador paso 7 (0.6.0) en el banco 30013: «Partida de Edgerunners» (tienda Mission Kit + RED ×2, neuropuerto de creación).
// Requiere el Mission Kit instalado en el banco (se activa y desactiva aquí). Uso: node tools/bench/gen07-edgerunners.mjs <salida.json> <capturas>
import { chromium } from "file:///E:/Users/odion/Desktop/project_developement/tmp/foundry-v12-browser/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:30013", out = process.argv[2], shots = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const R = { errors: [], steps: {} };
const step = (k, v) => { R.steps[k] = v; console.log(k, JSON.stringify(v).slice(0, 1200)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HELPERS = `
  window.__gen = (id) => foundry.applications.instances.get('cyberpunk-generador-' + id);
  window.__w = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__click = async (id, sel) => { const el = __gen(id).element.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); await __w(900); };
  window.__pick = async (id, sel, idx = 1) => { const s = __gen(id).element.querySelector(sel); if (!s) throw new Error('no ' + sel); s.selectedIndex = Math.min(idx, s.options.length - 1); s.dispatchEvent(new Event('change')); await __w(900); };
  window.__dialogYes = async () => { for (let i = 0; i < 24; i++) { const b = document.querySelector('.dialog .dialog-button.yes'); if (b) { b.click(); await __w(900); return true; } await __w(250); } return false; };
  window.__fillLifepath = async (id) => { for (let i = 0; i < 120; i++) { const empty = __gen(id).element.querySelector('.cprgen-slot.empty'); if (!empty) break; const sel = empty.querySelector('select[data-key]');
    if (sel?.dataset.key.endsWith('.n')) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); await __w(900); continue; }
    const btn = empty.querySelector('[data-action="rollSlot"]'); if (btn) { btn.click(); await __w(900); } else { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); await __w(900); } } };
  window.__shopPacks = (id) => [...__gen(id).element.querySelectorAll('select[data-shop-pack] option')].map((o) => o.value);
  window.__selectPack = async (id, pack) => { const s = __gen(id).element.querySelector('select[data-shop-pack]'); s.value = pack; s.dispatchEvent(new Event('change')); await __w(1500); };
  window.__priceOf = (id, uuid) => __gen(id).element.querySelector('[data-uuid="' + uuid + '"]')?.closest('tr')?.children[1]?.textContent.trim();
  window.__newComplete = async (name) => {
    const a = await game.modules.get('cyberpunk-generador').api.createBookNpc ? null : null;
    const actor = await Actor.implementation.create({ name, type: 'character' }); await __w(500);
    const x = game.actors.getName(name);
    game.modules.get('cyberpunk-generador').api.open(x); await __w(2000);
    await __click(x.id, '[data-method="complete"]'); await __click(x.id, '[data-step="role"]'); await __click(x.id, '[data-role="solo"]');
    await __click(x.id, '[data-step="skills"]'); await __pick(x.id, 'select[data-key="lang.origin"]', 3);
    await __click(x.id, '[data-step="lifepath"]'); await __fillLifepath(x.id);
    await __click(x.id, '[data-step="gear"]');
    return x.id;
  };
`;
async function login() {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  page.on("pageerror", (e) => R.errors.push(e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") R.errors.push(`console: ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.users?.size > 0, null, { timeout: 90000 });
  await page.evaluate(async () => { const u = game.users.find((x) => x.role === 4); await fetch("/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", userid: u.id, password: "" }) }); });
  for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/game`, { waitUntil: "load" }); await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 180000 }); await wait(3500); if (await page.evaluate(() => game.i18n.lang === "es")) break; await page.evaluate(() => game.settings.set("core", "language", "es")); }
  await page.evaluate(HELPERS);
  return page;
}
const C = "Compendium.cyberpunk-red-core.";
try {
  const st = await (await fetch(`${BASE}/api/status`)).json();
  if (!st.active) { await fetch(`${BASE}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launchWorld", world: "edgerunners-2070-pruebas" }) }); for (let i = 0; i < 60; i++) { await wait(3000); if ((await (await fetch(`${BASE}/api/status`)).json()).active) break; } }
  let gm = await login();
  // Estado inicial: Mission Kit desactivado en el mundo (se guarda la configuración para restaurarla al final).
  const original = await gm.evaluate(async () => { const c = game.settings.get("core", "moduleConfiguration"); const prev = { ...c }; c["edgerunners-mission-kit"] = false; await game.settings.set("core", "moduleConfiguration", c); return prev; });
  await gm.close(); await wait(2000); gm = await login();
  await gm.evaluate(async () => {
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN7] ")).map((a) => a.id));
    await game.settings.set("cyberpunk-generador", "edgerunnersGame", false);
    await game.settings.set("cyberpunk-generador", "rollPolicy", "free");
  });
  step("entorno", await gm.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, mk: game.modules.get("edgerunners-mission-kit")?.active ?? null, motor: game.modules.get("edgerunners-2070")?.active })));
  // A) Modo desactivado: tienda solo RED, precio RED.
  step("A-modo-off", await gm.evaluate(async (C) => {
    const id = await __newComplete("[GEN7] Sin modo");
    return { packs: __shopPacks(id), rifle: (await __selectPack(id, "cyberpunk-red-core.core_weapons"), __priceOf(id, C + "core_weapons.Item.QrQNdHTuEDxrfIxS")) };
  }, C));
  // B) Ajuste activado sin el Mission Kit: aviso y funcionamiento como RED.
  step("B-sin-mission-kit", await gm.evaluate(async () => {
    await game.settings.set("cyberpunk-generador", "edgerunnersGame", true); await __w(1500);
    const id = game.actors.getName("[GEN7] Sin modo").id;
    const note = [...document.querySelectorAll("#notifications .notification")].map((n) => n.textContent).find((t) => /Partida de Edgerunners/.test(t));
    return { note, packs: __shopPacks(id) };
  }));
  // Activa el Mission Kit y recarga.
  const prev = await gm.evaluate(async () => { const c = game.settings.get("core", "moduleConfiguration"); const prev = { ...c }; c["edgerunners-mission-kit"] = true; await game.settings.set("core", "moduleConfiguration", c); return prev; });
  await gm.close(); await wait(2000); gm = await login();
  step("C-entorno", await gm.evaluate(() => ({ mk: game.modules.get("edgerunners-mission-kit")?.active, setting: game.settings.get("cyberpunk-generador", "edgerunnersGame"), pack: Boolean(game.packs.get("edgerunners-mission-kit.objetos")) })));
  // C) Tienda Edgerunners y neuropuerto de creación.
  step("C-tienda", await gm.evaluate(async (C) => {
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    const id = await __newComplete("[GEN7] Edgerunner");
    const packs = __shopPacks(id);
    await __selectPack(id, "edgerunners-mission-kit.objetos");
    const mk = [...__gen(id).element.querySelectorAll(".cprgen-catalog tbody tr")].map((tr) => tr.children[0].textContent.trim() + ":" + tr.children[1].textContent.trim());
    const hint = __gen(id).element.querySelector(".cprgen-body .hint")?.textContent.trim();
    const carnage = [...__gen(id).element.querySelectorAll(".cprgen-catalog tbody tr")].find((tr) => /Carnage/.test(tr.children[0].textContent));
    carnage.querySelector('[data-action="shopAdd"]').click(); await __w(900);
    await __selectPack(id, "cyberpunk-red-core.core_weapons");
    const rifle = __priceOf(id, C + "core_weapons.Item.QrQNdHTuEDxrfIxS");
    await __selectPack(id, "cyberpunk-red-core.core_cyberware");
    for (const u of ["ju5Rq9rOe2lpDKKl", "UX79WfUt7Yungbx7"]) { __gen(id).element.querySelector(`[data-uuid="${C}core_cyberware.Item.${u}"]`).click(); await __w(900); }
    const cart = JSON.parse(game.actors.get(id).getFlag("cyberpunk-generador", "draft")).data.answers.cart.items.map((c) => `${c.name}:${c.price}:${c.pack}`);
    const totals = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    return { id, packs, mkCount: mk.length, mkSample: mk.slice(0, 4), neuroportMK: mk.find((x) => /^Neuropuerto:/.test(x)), hint, rifle, cart, totals };
  }, C));
  await gm.screenshot({ path: `${shots}/gen07-tienda.png` });
  step("C-aplicar", await gm.evaluate(async () => {
    const id = game.actors.getName("[GEN7] Edgerunner").id;
    await __click(id, '[data-step="review"]');
    const note = [...__gen(id).element.querySelectorAll(".cprgen-body .hint")].map((h) => h.textContent.trim());
    const missing = [...__gen(id).element.querySelectorAll(".cprgen-body li")].map((l) => l.textContent);
    await __click(id, '[data-action="applySheet"]'); await __dialogYes(); await __w(8000);
    const a = game.actors.get(id), s = a.system;
    const cw = a.itemTypes.cyberware.filter((c) => !c.system.core);
    const port = cw.find((c) => (c.flags?.["edgerunners-2070"]?.capabilities ?? []).some((x) => x.type === "neuroport"));
    const link = cw.find((c) => /Conexión neuronal/.test(c.name));
    const sande = cw.find((c) => /Sandevistan/.test(c.name));
    return { note, missing, emp: s.stats.emp.value, humanity: `${s.derivedStats.humanity.value}/${s.derivedStats.humanity.max}`, wealth: s.wealth.value,
      port: port ? { name: port.name, installed: port.system.isInstalled, install: port.flags["edgerunners-2070"]?.install?.mode, generated: port.getFlag("cyberpunk-generador", "generated") } : null,
      sandevistanIn: sande ? (link?.system.installedItems.list.includes(sande.id) ? "conexión neuronal" : port?.system.installedItems?.list?.includes(sande.id) ? "neuropuerto" : "otro") : null,
      weapons: a.itemTypes.weapon.map((w) => w.name), chat: game.messages.contents.at(-1)?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500) };
  }));
  // D) Rata callejera en modo Edgerunners: también recibe el neuropuerto.
  step("D-rata", await gm.evaluate(async () => {
    const actor = await Actor.implementation.create({ name: "[GEN7] Técnica", type: "character" }); await __w(500);
    const x = game.actors.getName("[GEN7] Técnica"), id = x.id;
    game.modules.get("cyberpunk-generador").api.open(x); await __w(2000);
    await __click(id, '[data-method="streetrat"]'); await __click(id, '[data-step="role"]'); await __click(id, '[data-role="tech"]');
    await __click(id, '[data-step="stats"]'); await __click(id, '[data-action="rollSlot"][data-key="stats.row"]');
    await __click(id, '[data-step="skills"]'); await __pick(id, 'select[data-key="lang.origin"]', 2);
    for (const s of [...__gen(id).element.querySelectorAll("select[data-key^='spec.']")].map((x) => x.dataset.key)) await __pick(id, `select[data-key="${s}"]`, 1);
    await __click(id, '[data-step="lifepath"]'); await __fillLifepath(id);
    await __click(id, '[data-step="gear"]');
    for (const s of [...__gen(id).element.querySelectorAll("select[data-key^='gear.']")].map((x) => x.dataset.key)) await __pick(id, `select[data-key="${s}"]`, 1);
    await __click(id, '[data-step="review"]');
    await __click(id, '[data-action="applySheet"]'); await __dialogYes(); await __w(8000);
    const cw = x.itemTypes.cyberware.filter((c) => !c.system.core);
    return { cyber: cw.map((c) => `${c.name}:${c.system.isInstalled}${c.flags?.["edgerunners-2070"]?.install?.mode ? ":" + c.flags["edgerunners-2070"].install.mode : ""}`), humanity: `${x.system.derivedStats.humanity.value}/${x.system.derivedStats.humanity.max}`, emp: x.system.stats.emp.value };
  }));
  // Restaura: ajuste desactivado y Mission Kit como estaba.
  await gm.evaluate(async (prev) => {
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN7] ")).map((a) => a.id));
    await game.settings.set("cyberpunk-generador", "edgerunnersGame", false);
    await game.settings.set("core", "moduleConfiguration", prev);
  }, original);
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
