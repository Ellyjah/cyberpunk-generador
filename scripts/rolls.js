/** Tiradas del generador: tirada de Foundry publicada en el chat, a nombre del actor y visible para todos. */
/** `rollMode`: público por defecto; los PNJ usan «gmroll» (solo el DJ). */
export async function rollToChat(actor, formula, flavor, rollMode = CONST.DICE_ROLL_MODES.PUBLIC) {
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>${game.i18n.localize("CPRGEN.chat.prefix")}</strong> ${flavor}`,
  }, { rollMode });
  return roll.total;
}
