/**
 * Rata callejera y equipo inicial (lógica pura). Produce el «plan» que apply.js escribe en la ficha.
 * Claves de respuesta usadas aquí (draft.data.answers):
 *   stats.row               fila (0–9) de la tabla de características del rol
 *   spec.<etiqueta>         especialidad elegida para «Ciencia (elige 1)», «Tocar instrumento (elige 1)»… → { uuid, text }
 *   lang.origin             idioma de origen → { uuid, text } (Item de core_skills-languages) o { text } (idioma no listado)
 *   gear.<cat>.<línea>      opción elegida (índice) en las líneas con varias opciones
 */

export const CLOTHING_STYLE = {
  "Ropa normal elegante": "genericChic", "Ropa de deporte": "leisurewear", "Tendencias urbanas": "urbanFlash",
  "Ropa de negocios": "businesswear", "Alta costura": "highFashion", "Ropa bohemia": "bohemian", "Ropa de mendigo": "bagLadyChic",
  "Colores de pandilla": "gangColors", "Cuero nómada": "nomadLeathers", "Moda asiática": "asiaPop",
};
export const CLOTHING_TYPE = {
  "parte de arriba": "top", "chaqueta": "jacket", "calzado": "footwear", "gafas": "glasses", "parte de abajo": "bottoms",
  "sombrero": "hats", "joyas": "jewelry", "lentes de contacto": "contactLenses", "gafas espejadas": "mirrorshades",
};
/** Mayúscula inicial (en el Core, la opción tras «o» va en minúscula). */
export const cap = (t) => (t ? t[0].toLocaleUpperCase("es") + t.slice(1) : t);

export const GEAR_CATEGORIES = ["weapons", "gear", "cyberware"];

/** Líneas de equipo con varias opciones: hay que elegir una. */
export function gearChoices(role) {
  const out = [];
  for (const cat of GEAR_CATEGORIES) role[cat].forEach((line, i) => { if (line.options?.length > 1) out.push({ key: `gear.${cat}.${i}`, cat, index: i, line }); });
  return out;
}

/** Especialidades que hay que elegir (habilidades con especialidad en la plantilla). */
export function specialtyChoices(skills) {
  return skills.filter((s) => s.specialtyPack).map((s) => ({ key: `spec.${s.label}`, label: s.label, pack: s.specialtyPack, level: s.level }));
}

/** Respuestas pendientes de Rata callejera (sin vida pasada, que tiene su propia comprobación). */
export function missingStreetrat(role, answers) {
  const miss = [];
  if (!Number.isInteger(answers["stats.row"]?.row)) miss.push("stats.row");
  for (const s of specialtyChoices(role.streetratSkills)) if (!answers[s.key]?.uuid) miss.push(s.key);
  if (!answers["lang.origin"]?.text) miss.push("lang.origin");
  for (const g of gearChoices(role)) if (!Number.isInteger(answers[g.key]?.row)) miss.push(g.key);
  return miss;
}

/** Items del equipo inicial tras las elecciones: [{uuid, qty, cat}] y prendas [{style, type, qty, text}]. */
export function chosenGear(role, answers) {
  const items = [], clothing = [];
  for (const cat of GEAR_CATEGORIES) {
    role[cat].forEach((line, i) => {
      if (line.clothing) {
        const style = CLOTHING_STYLE[line.clothing.style];
        for (const it of line.clothing.items) clothing.push({ style, type: CLOTHING_TYPE[it.type], qty: it.qty, text: `${line.clothing.style}: ${it.type}` });
        return;
      }
      const opt = line.options.length > 1 ? line.options[answers[`gear.${cat}.${i}`]?.row] : line.options[0];
      if (opt) items.push({ uuid: opt.uuid, qty: opt.qty, cat, name: cap(opt.name) });
    });
  }
  return { items, clothing };
}

/** Plan completo de Rata callejera para apply.js. */
export function streetratPlan(role, answers, rules) {
  const stats = role.statTable[answers["stats.row"].row];
  const skills = role.streetratSkills.map((s) => {
    const spec = s.specialtyPack ? answers[`spec.${s.label}`] : null;
    return spec ? { label: s.label, uuid: spec.uuid, text: spec.text, level: s.level } : { label: s.label, red: s.red, redId: s.redId, level: s.level };
  });
  const lang = answers["lang.origin"];
  skills.push({ label: "origin-language", uuid: lang.uuid ?? null, text: lang.text, level: rules.cultureLanguageLevel });
  const housing = role.key === "exec" ? rules.housing.exec : rules.housing.default;
  return { roleUuid: role.uuid, roleRank: rules.roleAbilityStart, stats, skills, ...chosenGear(role, answers), money: rules.extraMoney, housing };
}
