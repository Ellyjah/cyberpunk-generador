/**
 * Cyberpunk RED — Generador de personajes. Punto de entrada.
 * Documentación de desarrollo y traspaso: DESARROLLO.md (en la raíz del módulo).
 */
import { MODULE_ID } from "./logic/core.js";
import { registerSettings } from "./settings.js";
import { listenSocket } from "./socket.js";
import { openGenerator, userCanUse } from "./wizard.js";
import { openMenu, createBookNpc, createQuickNpc } from "./npc.js";

const L = (k, d) => game.i18n.format(`CPRGEN.${k}`, d ?? {});

Hooks.once("init", () => {
  registerSettings();
  game.modules.get(MODULE_ID).api = { open: openGenerator, menu: openMenu, createBookNpc, createQuickNpc };
});

Hooks.once("ready", () => listenSocket());

// Botón en la cabecera de la ficha (hojas V1 de RED): solo si el usuario puede usarlo sobre ese actor.
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor;
  if (!actor || !userCanUse(game.user, actor)) return;
  buttons.unshift({ label: L("button.sheet"), class: "cprgen-open", icon: "fas fa-user-plus", onclick: () => openGenerator(actor) });
});

// Botón del DJ en el directorio de actores: menú (personaje jugador, PNJ del libro, encuentro aleatorio, PNJ rápido por rol).
Hooks.on("renderActorDirectory", (_app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const bar = root?.querySelector(".header-actions");
  if (!bar || bar.querySelector(".cprgen-new")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cprgen-new";
  btn.innerHTML = `<i class="fas fa-user-plus"></i> ${L("button.directory")}`;
  btn.addEventListener("click", () => openMenu());
  bar.append(btn);
});
