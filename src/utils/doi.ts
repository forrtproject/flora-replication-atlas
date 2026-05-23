// Anything that separates DOIs in a pasted citation list: commas, semicolons,
// and any whitespace (spaces, tabs, newlines).
const DOI_DELIMITER_RE = /[\s,;]+/;
const DOI_PREFIX_RE = /10\./g;

export type DoiPasteResult =
  | { kind: "none" }
  | { kind: "single"; doi: string }
  | { kind: "multi"; dois: string[] }
  | { kind: "reject"; reason: string };

export const MULTI_DOI_WHITESPACE_REJECTION =
  "If you copy in multiple DOIs at once, they must not contain any spaces or other whitespace within them.";

export function parseDoiPaste(raw: string): DoiPasteResult {
  // No delimiters → not a multi-DOI paste; let normal paste behavior run.
  if (!DOI_DELIMITER_RE.test(raw)) return { kind: "none" };

  const prefixCount = (raw.match(DOI_PREFIX_RE) || []).length;

  // Zero or one "10." in the pasted text: assume any whitespace is accidental
  // (line wrap, trailing newline, copy-paste artifact) and collapse it.
  if (prefixCount <= 1) {
    const collapsed = raw.replace(/[\s,;]+/g, "").trim();
    if (!collapsed) return { kind: "none" };
    return { kind: "single", doi: collapsed };
  }

  // Multiple "10." occurrences: each delimiter-separated chunk must itself be
  // a DOI. If any chunk doesn't start with "10.", the user pasted DOIs that
  // contain internal whitespace and we can't safely guess where the breaks are.
  const parts = raw
    .split(DOI_DELIMITER_RE)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const allValid = parts.every((p) => p.startsWith("10."));
  if (!allValid) {
    return { kind: "reject", reason: MULTI_DOI_WHITESPACE_REJECTION };
  }
  return { kind: "multi", dois: parts };
}
