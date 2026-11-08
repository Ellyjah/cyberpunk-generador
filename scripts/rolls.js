/** Tiradas del generador: tirada de Foundry publicada en el chat, a nombre del actor y visible para todos. */
export async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>${game.i18n.localize("CPRGEN.chat.prefix")}</strong> ${flavor}`,
  }, { rollMode: CONST.DICE_ROLL_MODES.PUBLIC });
  return roll.total;
}
