// Generador paso 5 (0.4.0) en el banco 30013:
//  A) Paquete completo de Jay (62/86/tienda con cajas y moda) y aplicación;
//  B) segunda aplicación del DJ: ventana de autorización y sustitución sin duplicados;
//  C) segunda aplicación pedida por un jugador: el DJ la autoriza y se aplica;
//  D) autorizar/bloquear a los jugadores con efecto inmediato;
//  E) solo RED: Rata callejera con Babele, traducción, Core y motor desactivados (y se restauran).
// Uso: node tools/bench/gen05-paquete-completo.mjs <salida.json> <carpeta-capturas>
import { chromium } from "file:///E:/Users/odion/Desktop/project_developement/tmp/foundry-v12-browser/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const BASE = "http://127.0.0.1:30013", out = process.argv[2], shots = process.argv[3];
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const R = { errors: [], steps: {} };
const step = (k, v) => { R.steps[k] = v; console.log(k, JSON.stringify(v).slice(0, 900)); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HELPERS = `
  window.__gen = (id) => foundry.applications.instances.get('cyberpunk-generador-' + id);
  window.__w = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__click = async (id, sel) => { const el = __gen(id).element.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); await __w(900); };
  window.__pick = async (id, sel, idx = 1) => { const s = __gen(id).element.querySelector(sel); if (!s) throw new Error('no ' + sel); s.selectedIndex = Math.min(idx, s.options.length - 1); s.dispatchEvent(new Event('change')); await __w(900); };
  window.__set = async (id, sel, v) => { const i = __gen(id).element.querySelector(sel); if (!i) throw new Error('no ' + sel); i.value = v; i.dispatchEvent(new Event('change')); await __w(700); };
  window.__dialogYes = async () => { for (let i = 0; i < 24; i++) { const b = document.querySelector('.dialog .dialog-button.yes'); if (b) { b.click(); await __w(900); return true; } await __w(250); } return false; };
  window.__draft = (id) => JSON.parse(game.actors.get(id).getFlag('cyberpunk-generador', 'draft'));
  window.__fillLifepath = async (id) => {
    for (let i = 0; i < 120; i++) {
      const empty = __gen(id).element.querySelector('.cprgen-slot.empty'); if (!empty) break;
      const sel = empty.querySelector('select[data-key]');
      if (sel?.dataset.key.endsWith('.n')) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); await __w(900); continue; } // recuentos a 0
      const btn = empty.querySelector('[data-action="rollSlot"]');
      if (btn) { btn.click(); await __w(900); } else { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); await __w(900); }
    }
    return __gen(id).element.querySelectorAll('.cprgen-slot.empty').length;
  };
  window.__sheetState = (id) => { const a = game.actors.get(id), s = a.system; const lvl = (n) => a.itemTypes.skill.find((i) => i.name === n)?.system.level;
    return { stats: Object.values(s.stats).map((v) => v.value).join(','), roles: a.itemTypes.role.length, generated: a.items.filter((i) => i.getFlag('cyberpunk-generador', 'generated')).length,
      cyber: a.itemTypes.cyberware.filter((c) => !c.system.core).map((c) => c.name + ':' + c.system.isInstalled), ammo: a.itemTypes.ammo.map((i) => i.name + ':' + i.system.amount),
      wealth: s.wealth.value, humanity: s.derivedStats.humanity.value + '/' + s.derivedStats.humanity.max, emp: s.stats.emp.value,
      skills: { Autofire: lvl('Autofire'), Melee: lvl('Melee Weapon'), Athletics: lvl('Athletics'), Handgun: lvl('Handgun') }, martial: a.itemTypes.skill.filter((i) => !i.system.core).map((i) => i.name + ':' + i.system.level),
      record: JSON.parse(a.getFlag('cyberpunk-generador', 'applied') ?? 'null') }; };
`;
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
  await page.evaluate(HELPERS);
  return page;
}
try {
  const st = await (await fetch(`${BASE}/api/status`)).json();
  if (!st.active) { await fetch(`${BASE}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launchWorld", world: "edgerunners-2070-pruebas" }) }); for (let i = 0; i < 60; i++) { await wait(3000); if ((await (await fetch(`${BASE}/api/status`)).json()).active) break; } }
  let gm = await login("x.role === 4");
  step("entorno", await gm.evaluate(() => ({ gen: game.modules.get("cyberpunk-generador")?.version, mods: [...game.modules].filter((m) => m.active).map((m) => m.id), players: game.settings.get("cyberpunk-generador", "playersEnabled"), rank: game.settings.get("cyberpunk-generador", "completeRank") })));
  const ids = await gm.evaluate(async () => {
    await game.settings.set("cyberpunk-generador", "rollPolicy", "free");
    await game.settings.set("cyberpunk-generador", "playersEnabled", true);
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN5] ")).map((a) => a.id));
    const player = game.users.find((u) => !u.isGM);
    const a = await Actor.implementation.create({ name: "[GEN5] Jay", type: "character", ownership: { default: 0, [player.id]: 3 } });
    game.modules.get("cyberpunk-generador").api.open(a); await __w(2000);
    return { id: a.id, player: player.id };
  });
  const id = ids.id;
  // A) Paquete completo de Jay.
  step("A-caracteristicas", await gm.evaluate(async (id) => {
    await __click(id, '[data-method="complete"]'); await __click(id, '[data-step="role"]'); await __click(id, '[data-role="solo"]'); await __click(id, '[data-step="stats"]');
    const before = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    const J = { int: 5, ref: 7, dex: 8, tech: 3, cool: 6, will: 7, luck: 6, move: 8, body: 8, emp: 4 };
    for (const [k, v] of Object.entries(J)) await __set(id, `input[data-stat-key="stats.${k}"]`, v);
    const after = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    await __set(id, 'input[data-stat-key="stats.int"]', 12); // se recorta a 8
    const clamped = __draft(id).data.answers["stats.int"];
    const over = __gen(id).element.querySelector(".cprgen-points").classList.contains("over");
    await __set(id, 'input[data-stat-key="stats.int"]', 5);
    return { before, after, clamped, over };
  }, id));
  step("A-habilidades", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="skills"]');
    const before = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    const S = { "Arma cuerpo a cuerpo": 5, "Armas cortas": 4, "Armas largas": 4, "Artes marciales": 2, "Conducir vehículo terrestre": 4, "Deducción": 4, "Disparo automático": 6, "Interrogatorio": 4, "Rastrear": 4, "Resistencia": 4, "Resistir torturas/drogas": 4, "Supervivencia": 4, "Tácticas": 3 };
    for (const [k, v] of Object.entries(S)) await __set(id, `input[data-skill-key="skill.${k}"]`, v);
    const specMissing = __draft(id).data.answers["spec.Artes marciales"] ?? null;
    await __pick(id, 'select[data-key="spec.Artes marciales"]', 2);
    await __pick(id, 'select[data-key="lang.origin"]', 4);
    await __set(id, 'input[data-skill-key="skill.Atletismo"]', 0); // básica: se recorta a 2
    return { before, after: __gen(id).element.querySelector(".cprgen-points").textContent.trim(), specMissing, spec: __draft(id).data.answers["spec.Artes marciales"], athletics: __draft(id).data.answers["skill.Atletismo"], rows: __gen(id).element.querySelectorAll(".cprgen-skills tbody tr").length };
  }, id));
  await gm.screenshot({ path: `${shots}/gen05-habilidades.png` });
  step("A-vida-pasada", await gm.evaluate(async (id) => { await __click(id, '[data-step="lifepath"]'); return { empty: await __fillLifepath(id) }; }, id));
  step("A-tienda", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="gear"]');
    const add = async (pack, uuid, times = 1) => {
      const sel = __gen(id).element.querySelector("select[data-shop-pack]"); sel.value = `cyberpunk-red-core.${pack}`; sel.dispatchEvent(new Event("change")); await __w(1500);
      for (let i = 0; i < times; i++) { const b = __gen(id).element.querySelector(`[data-action="shopAdd"][data-uuid="${uuid}"]`); if (!b) throw new Error("sin botón " + uuid); b.click(); await __w(900); }
    };
    const C = "Compendium.cyberpunk-red-core.";
    await add("core_cyberware", C + "core_cyberware.Item.ju5Rq9rOe2lpDKKl"); // conexión neuronal
    await add("core_cyberware", C + "core_cyberware.Item.UX79WfUt7Yungbx7"); // Sandevistan
    await add("core_weapons", C + "core_weapons.Item.QrQNdHTuEDxrfIxS");     // fusil de asalto
    await add("core_ammo", C + "core_ammo.Item.J3NfMgRdqoUwFDDs", 10);      // munición de fusil: 10 cajas
    await add("core_ammo", C + "core_ammo.Item.7xhKxgwOELzaPyYr", 2);       // granada de humo ×2
    await add("core_armor", C + "core_armor.Item.uaN9WukkezPfcutU");
    // Moda: primera prenda del catálogo de moda, y búsqueda.
    const sel = __gen(id).element.querySelector("select[data-shop-pack]"); sel.value = "cyberpunk-red-core.core_clothing"; sel.dispatchEvent(new Event("change")); await __w(1500);
    const q = __gen(id).element.querySelector("input[data-shop-query]"); q.value = "zz-no-existe"; q.dispatchEvent(new Event("input")); await __w(1500);
    const none = __gen(id).element.querySelectorAll(".cprgen-catalog tbody tr").length;
    const q2 = __gen(id).element.querySelector("input[data-shop-query]"); q2.value = ""; q2.dispatchEvent(new Event("input")); await __w(1500);
    // Una prenda barata (20 ed): la primera por orden alfabético es de alta costura (5000 ed) y bloquearía la compra.
    const cheap = [...__gen(id).element.querySelectorAll(".cprgen-catalog tbody tr")].find((tr) => tr.children[1]?.textContent.trim() === "20 ed");
    cheap.querySelector('[data-action="shopAdd"]').click(); await __w(900);
    const cart = __draft(id).data.answers.cart.items.map((c) => `${c.name}:${c.packs}x${c.price}${c.fashion ? ":moda" : ""}`);
    const totals = __gen(id).element.querySelector(".cprgen-points").textContent.trim();
    // Cambiar cantidad desde el carrito y quitar una línea.
    await __set(id, 'input[data-cart-index="4"]', 3);
    const smoke = __draft(id).data.answers.cart.items[4];
    await __set(id, 'input[data-cart-index="4"]', 2);
    return { cart, totals, none, smoke };
  }, id));
  await gm.screenshot({ path: `${shots}/gen05-tienda.png` });
  step("A-aplicar", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="review"]');
    const missing = [...__gen(id).element.querySelectorAll(".cprgen-body li")].map((l) => l.textContent);
    await __click(id, '[data-action="applySheet"]'); await __dialogYes(); await __w(7000);
    return { missing, state: __sheetState(id), button: __gen(id).element.querySelector(".cprgen-apply")?.textContent.trim() };
  }, id));
  await gm.screenshot({ path: `${shots}/gen05-revision.png` });
  // B) Segunda aplicación del DJ, con otro reparto (menos munición), sustituyendo a la primera.
  step("B-reaplicar-dj", await gm.evaluate(async (id) => {
    await __click(id, '[data-step="gear"]');
    await __set(id, 'input[data-cart-index="3"]', 5); // 5 cajas de munición de fusil
    await __click(id, '[data-step="review"]');
    await __click(id, '[data-action="applySheet"]');
    const title = document.querySelector(".dialog .window-title")?.textContent;
    await __dialogYes(); await __w(9000);
    return { dialogTitle: title, state: __sheetState(id), chat: game.messages.contents.at(-1)?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300) };
  }, id));
  // C) Segunda aplicación pedida por el jugador.
  const pl = await login("!x.isGM");
  step("C-jugador-pide", await pl.evaluate(async (id) => {
    game.modules.get("cyberpunk-generador").api.open(game.actors.get(id)); await __w(2500);
    await __click(id, '[data-step="review"]');
    const button = __gen(id).element.querySelector(".cprgen-apply")?.textContent.trim();
    await __click(id, '[data-action="applySheet"]');
    return { button, localDialog: Boolean(document.querySelector(".dialog")) };
  }, id));
  step("C-dj-autoriza", await gm.evaluate(async (id) => {
    const text = (() => { for (const d of document.querySelectorAll(".dialog .dialog-content")) return d.textContent.replace(/\s+/g, " ").slice(0, 200); })();
    const ok = await __dialogYes(); await __w(9000);
    return { ok, text, state: __sheetState(id) };
  }, id));
  // D) Bloquear y autorizar a los jugadores.
  await pl.evaluate(async (id) => { game.actors.get(id).sheet.render(true); await __w(2500); }, id);
  const before = await pl.evaluate((id) => ({ btn: Boolean(game.actors.get(id).sheet.element?.[0]?.querySelector(".cprgen-open")), wizard: Boolean(__gen(id)) }), id);
  await gm.evaluate(() => game.settings.set("cyberpunk-generador", "playersEnabled", false)); await wait(3000);
  const closed = await pl.evaluate((id) => ({ btn: Boolean(document.querySelector(".cprgen-open")), wizard: Boolean(__gen(id)), note: [...document.querySelectorAll("#notifications .notification")].map((n) => n.textContent).slice(-1)[0] }), id);
  await gm.evaluate(() => game.settings.set("cyberpunk-generador", "playersEnabled", true)); await wait(4000);
  const opened = await pl.evaluate((id) => ({ btn: Boolean(game.actors.get(id).sheet.element?.[0]?.querySelector(".cprgen-open")) }), id);
  step("D-autorizacion", { before, closed, opened });
  await pl.close();
  // E) Solo RED: desactiva los demás módulos, recarga y aplica una Rata callejera; después restaura.
  const prev = await gm.evaluate(async () => {
    const conf = game.settings.get("core", "moduleConfiguration"); const prev = { ...conf };
    for (const m of ["babele", "cyberpunk-tr-esp", "cyberpunk-red-core-private", "edgerunners-2070", "lib-wrapper"]) if (m in conf) conf[m] = false;
    await game.settings.set("core", "moduleConfiguration", conf); return prev;
  });
  await gm.close(); await wait(2000);
  gm = await login("x.role === 4");
  step("E-solo-red", await gm.evaluate(async () => {
    const active = [...game.modules].filter((m) => m.active).map((m) => m.id);
    const a = await Actor.implementation.create({ name: "[GEN5] Solo RED", type: "character" });
    const id = a.id;
    game.modules.get("cyberpunk-generador").api.open(a); await __w(2500);
    await __click(id, '[data-method="streetrat"]'); await __click(id, '[data-step="role"]'); await __click(id, '[data-role="fixer"]');
    await __click(id, '[data-step="stats"]'); await __click(id, '[data-action="rollSlot"][data-key="stats.row"]');
    await __click(id, '[data-step="skills"]'); await __pick(id, 'select[data-key="lang.origin"]', 2);
    const langName = __draft(id).data.answers["lang.origin"].text;
    await __click(id, '[data-step="lifepath"]'); const empty = await __fillLifepath(id);
    await __click(id, '[data-step="gear"]');
    for (const s of [...__gen(id).element.querySelectorAll("select[data-key^='gear.']")].map((x) => x.dataset.key)) await __pick(id, `select[data-key="${s}"]`, 1);
    await __click(id, '[data-step="review"]');
    const missing = [...__gen(id).element.querySelectorAll(".cprgen-body li")].map((l) => l.textContent);
    await __click(id, '[data-action="applySheet"]'); await __dialogYes(); await __w(7000);
    const st = __sheetState(id);
    const lp = game.actors.get(id).system.lifepath.culturalOrigin.replace(/<[^>]+>/g, "").slice(0, 80);
    return { active, langName, empty, missing, roleName: a.itemTypes.role[0]?.name, st, lp, skillHandgun: st.skills.Handgun };
  }));
  await gm.screenshot({ path: `${shots}/gen05-solo-red.png` });
  await gm.evaluate(async (prev) => { await game.settings.set("core", "moduleConfiguration", prev); }, prev);
  await gm.close(); await wait(2000);
  gm = await login("x.role === 4");
  step("E-restaurado", await gm.evaluate(() => [...game.modules].filter((m) => m.active).map((m) => m.id)));
  await gm.evaluate(async () => {
    for (const a of foundry.applications.instances.values()) if (a.constructor.isCprGenerator) await a.close();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[GEN5] ")).map((a) => a.id));
  });
} catch (e) { R.fatal = String(e.stack ?? e).slice(0, 1500); console.log("FATAL", R.fatal); }
finally { fs.writeFileSync(out, JSON.stringify(R, null, 1)); await browser.close(); }
