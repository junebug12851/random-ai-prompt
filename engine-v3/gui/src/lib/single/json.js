/**
 * @file JSON syntax highlighting for the single-image view's raw-metadata panel.
 */

/**
 * Wrap JSON tokens in classed spans for syntax highlighting (input is HTML-escaped first).
 * @param {string} json A pretty-printed JSON string.
 * @returns {string} HTML with `<span class="json-*">` token wrappers.
 */
export function syntaxHighlightJson(json) {
  const esc = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "json-num";
      if (/^"/.test(m)) cls = /:$/.test(m) ? "json-key" : "json-str";
      else if (/true|false/.test(m)) cls = "json-bool";
      else if (/null/.test(m)) cls = "json-null";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}
