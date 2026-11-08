/**
 * Vida pasada (lógica pura). Las respuestas viven en draft.data.answers con claves de «hueco»:
 *   g.<sección>            fila de la sección (una tirada da la fila entera)
 *   g.<sección>.c<k>       fila de la columna k (secciones perColumn)
 *   g.<sección>.n          recuento (secciones con count: 1d10-7)
 *   g.<sección>.<i>[.c<k>] entrada i de una sección con recuento
 *   g.enemies.<i>.wronged  parte perjudicada (elección)
 *   g.revenge.<i>          venganza del enemigo i
 *   lang.origin            idioma de origen (se elige una vez, en el paso Habilidades) → { uuid?, text }
 *   r.<nodo>               vida pasada de rol: fila (tabla) o valor (decisión)
 * Cada respuesta: { row } (índice de fila), { count }, { value } o { text }; `total` si salió de una tirada.
 */

/** Índice de la fila que corresponde a un resultado del dado, o -1. */
export function rowForTotal(table, total) {
  return table.rows.findIndex((r) => total >= r.min && total <= r.max);
}

/** Recuento a partir de un total de 1d10 según «1d10-7 (mínimo 0)». */
export function countFromTotal(formula, total) {
  const m = /^1d10-(\d+)$/.exec(formula);
  return m ? Math.max(0, total - Number(m[1])) : total;
}

/** Nodos de la vida pasada de rol que aplican con las decisiones tomadas. */
export function activeRoleNodes(nodes, answers) {
  return nodes.filter((n) => !n.when || answers[`r.${n.when.id}`]?.value === n.when.value);
}

/**
 * Lista ordenada de huecos de la vida pasada general y de rol. Cada hueco:
 * { key, kind: "row"|"count"|"choice"|"lang", section|node, column?, label, group }
 */
export function lifepathSlots(sections, roleNodes, answers) {
  const slots = [];
  const bySec = Object.fromEntries(sections.map((s) => [s.id, s]));
  const rowSlots = (s, base, group) => {
    if (s.perColumn) s.columns.forEach((c, k) => slots.push({ key: `${base}.c${k}`, kind: "row", section: s.id, column: k, label: c, group }));
    else slots.push({ key: base, kind: "row", section: s.id, label: s.columns.join(" / "), group });
  };
  for (const s of sections) {
    if (s.perEnemy) continue; // la venganza va dentro de cada enemigo
    if (!s.count) {
      rowSlots(s, `g.${s.id}`, s.title);
      continue;
    }
    slots.push({ key: `g.${s.id}.n`, kind: "count", section: s.id, label: s.title, group: s.title, formula: s.count });
    const n = answers[`g.${s.id}.n`]?.count ?? 0;
    for (let i = 0; i < n; i++) {
      const group = `${s.title} (${i + 1})`;
      rowSlots(s, `g.${s.id}.${i}`, group);
      if (s.wronged) slots.push({ key: `g.${s.id}.${i}.wronged`, kind: "choice", section: s.id, options: s.wronged, label: "wronged", group });
      if (s.then && bySec[s.then]) slots.push({ key: `g.${s.then}.${i}`, kind: "row", section: s.then, label: bySec[s.then].columns[0], group });
    }
  }
  for (const n of activeRoleNodes(roleNodes, answers)) {
    if (n.type === "choice") slots.push({ key: `r.${n.id}`, kind: "choice", node: n.id, options: n.options, label: n.title, group: "role" });
    else slots.push({ key: `r.${n.id}`, kind: "row", node: n.id, label: n.title, group: "role" });
  }
  return slots;
}

/** Tabla (sección o nodo) de un hueco de fila. */
export function slotTable(slot, sections, roleNodes) {
  if (slot.section) return sections.find((s) => s.id === slot.section);
  return roleNodes.find((n) => n.id === slot.node);
}

/** Texto mostrado de una respuesta de fila: la celda de la columna o la fila entera. */
export function rowText(table, slot, answer) {
  const row = table?.rows[answer?.row];
  if (!row) return "";
  return slot.column !== undefined ? row.cells[slot.column] : row.cells.join(" — ");
}

/** ¿Faltan huecos por rellenar? Devuelve las claves pendientes. */
export function missingSlots(slots, answers) {
  return slots.filter((s) => {
    const a = answers[s.key];
    if (s.kind === "count") return !Number.isInteger(a?.count);
    if (s.kind === "choice") return !a?.value;
    if (s.kind === "lang") return !a?.text;
    return !Number.isInteger(a?.row);
  }).map((s) => s.key);
}

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Texto HTML para cada campo system.lifepath.* de RED a partir de las respuestas.
 * `labels` traduce valores de elecciones ({wronged: {you: "Tú", them: "Tu enemigo"}, wrongedTitle}).
 */
export function lifepathFields(sections, roleNodes, answers, labels = {}) {
  const out = {};
  const add = (field, html) => { if (field && html) out[field] = (out[field] ?? "") + html; };
  const bySec = Object.fromEntries(sections.map((s) => [s.id, s]));
  const cellsOf = (s, base) => s.columns.map((c, k) => {
    const a = answers[s.perColumn ? `${base}.c${k}` : base];
    return s.rows[a?.row]?.cells[k] ?? "";
  });
  for (const s of sections) {
    if (s.perEnemy) continue;
    if (!s.count) {
      const cells = cellsOf(s, `g.${s.id}`);
      s.fields.forEach((f, k) => {
        if (!f) return;
        let txt = cells[k];
        if (s.languages && answers["lang.origin"]?.text) txt += ` ${labels.languageLabel ?? "Idioma"}: ${answers["lang.origin"].text.replace(/^[^(]*\((.+)\)$/, "$1")}.`;
        add(f, `<p>${s.fields.filter((x) => x === f).length > 1 ? `<strong>${esc(s.columns[k])}:</strong> ` : ""}${esc(txt)}</p>`);
      });
      continue;
    }
    const n = answers[`g.${s.id}.n`]?.count ?? 0;
    if (n === 0) { add(s.fields[0], `<p>${esc(labels.none ?? "Ninguno")}.</p>`); continue; }
    for (let i = 0; i < n; i++) {
      const cells = cellsOf(s, `g.${s.id}.${i}`);
      const parts = s.columns.map((c, k) => `<strong>${esc(c)}:</strong> ${esc(cells[k])}`);
      const w = answers[`g.${s.id}.${i}.wronged`]?.value;
      if (s.wronged && w) parts.push(`<strong>${esc(labels.wrongedTitle ?? "Perjudicado")}:</strong> ${esc(s.wronged.find((o) => o.value === w)?.label ?? w)}`);
      if (s.then && bySec[s.then]) {
        const t = bySec[s.then];
        parts.push(`<strong>${esc(t.columns[0])}</strong> ${esc(t.rows[answers[`g.${s.then}.${i}`]?.row]?.cells[0] ?? "")}`);
      }
      add(s.fields[0], `<p>${i + 1}. ${parts.join("<br>")}</p>`);
    }
  }
  const role = [];
  for (const n of activeRoleNodes(roleNodes, answers)) {
    const a = answers[`r.${n.id}`];
    if (n.type === "choice") role.push(`<p><strong>${esc(n.title)}</strong> ${esc(n.options.find((o) => o.value === a?.value)?.label ?? "")}</p>`);
    else role.push(`<p><strong>${esc(n.title)}</strong> ${esc(n.rows[a?.row]?.cells.join(" — ") ?? "")}</p>`);
  }
  if (role.length) out.roleLifepath = role.join("");
  return out;
}
