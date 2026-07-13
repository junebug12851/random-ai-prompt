/**
 * @file Markdown export for the single-image view: the prompt, negative, and present detail rows
 * as a copyable Markdown block (with a project credit line).
 */

/**
 * Build a Markdown block of the prompt, negative, and (present) detail rows.
 * @param {string} promptFinal The sent prompt text.
 * @param {string} negFinal The sent negative prompt text.
 * @param {Array<[string, *]>} rows The [label, value] detail rows.
 * @returns {string} The Markdown block.
 */
export function toMarkdown(promptFinal, negFinal, rows) {
  const lines = [];
  if (promptFinal) lines.push(`**Prompt**: ${promptFinal}`, "");
  if (negFinal) lines.push(`**Negative prompt**: ${negFinal}`, "");
  const present = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (present.length) {
    lines.push("| Field | Value |", "| --- | --- |");
    for (const [k, v] of present) lines.push(`| ${k} | ${String(v).replace(/\|/g, "\\|")} |`);
    lines.push("");
  }
  lines.push(
    "Generated using [Random AI Prompt](https://github.com/1fairyfox/random-ai-prompt)",
  );
  return lines.join("\n");
}
