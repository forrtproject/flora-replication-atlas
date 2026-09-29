/* `outcome_quote_source` is free text a curator typed, so it arrives as
   "abstract", "full_text", "pp. 7-8", a bare URL, or several sources joined by
   "||". This renders one of those as something a sentence can hold. */

// Places that read as "the <x>"; everything else is passed through as written.
const SECTIONS = new Set([
  "abstract",
  "full text",
  "discussion",
  "introduction",
  "results",
  "conclusion",
  "method",
  "methods",
  "appendix",
  "table",
]);

/** @returns {string} the source phrase, or "" when none was recorded. */
export function quoteSourcePhrase(raw) {
  // Curators separate per-claim sources the way they separate the quotes.
  const first = String(raw ?? "")
    .split("||")[0]
    .trim()
    .replace(/\s+/g, " ");
  if (!first) return "";

  // "full_text", "fulltext" and "Full text" all name the same place.
  const canon = first.replace(/^full[\s_-]?text$/i, "full text");

  const url = canon.match(/https?:\/\/(?:www\.)?([^/\s]+)/);
  if (url) {
    const host = url[1].replace(/[.,;)]+$/, "");
    const lead = canon
      .slice(0, url.index)
      .trim()
      .replace(/[,:]$/, "")
      .replace(/\s+(?:at|on|in|from)$/i, "");
    return lead ? `${lead} (${host})` : host;
  }

  const lower = canon.toLowerCase();
  return SECTIONS.has(lower) ? `the ${lower}` : canon;
}
