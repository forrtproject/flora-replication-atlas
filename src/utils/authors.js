/**
 * Author-list normalization.
 *
 * Plain JS with JSDoc types so the Node prerender script and the Solid client
 * share one implementation.
 */

/** @typedef {{ given: string, family: string, sequence?: string, ORCID?: string }} Author */

// Surname particles that belong with the family name, not the given names.
const PARTICLES = new Set([
  "van", "von", "de", "del", "della", "der", "den", "di", "da", "das", "dos",
  "du", "la", "le", "lo", "ten", "ter", "bin", "ibn", "al", "st", "st.",
]);

const INITIALS_RE = /^(?:[A-Z]\.?[\s-]*)+$/;
const HAS_INITIALS_RE = /(?:^|[\s,])[A-Z]\.(?:\s|,|$)/;
// APA bylines elide the middle of a long list with "…"; it is never a name part.
const LEADING_ELLIPSIS_RE = /^(?:\.{3}|…)\s*/;

/** @param {string} name — "Given Middle Family" @returns {Author} */
function fromGivenFirst(name) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return { given: "", family: name };
  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase())) start--;
  return {
    given: parts.slice(0, start).join(" "),
    family: parts.slice(start).join(" "),
  };
}

/** "Somo, A., Fox, N. W., & Luis, B." — commas separate surname from initials and author from author. */
function fromApaList(raw) {
  /** @type {Author[]} */
  const out = [];
  for (const token of raw.split(/\s*[,&]\s*|\s+and\s+/)) {
    const t = token.trim().replace(LEADING_ELLIPSIS_RE, "").trim();
    if (!t) continue;
    if (INITIALS_RE.test(t) && out.length > 0 && !out[out.length - 1].given) {
      out[out.length - 1].given = t;
    } else {
      out.push({ given: "", family: t });
    }
  }
  return out;
}

/**
 * Coerce whatever the API served into an `Author[]`. Records reach the atlas
 * with authors as an array, a JSON-encoded array, a "A; B; C" list, an APA
 * byline, or a single corporate name.
 * @param {unknown} authors
 * @returns {Author[]}
 */
export function normalizeAuthors(authors) {
  if (Array.isArray(authors)) return authors;

  const raw = String(authors ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON after all — fall through to the text forms.
    }
  }

  /** @type {Author[]} */
  let people;
  if (raw.includes(";")) {
    people = raw
      .split(";")
      .map((n) => n.trim().replace(LEADING_ELLIPSIS_RE, "").trim())
      .filter(Boolean)
      .map(fromGivenFirst);
  } else if (HAS_INITIALS_RE.test(raw)) {
    people = fromApaList(raw);
  } else {
    // A lone name with no delimiters is a corporate author ("Open Science
    // Collaboration"), not a person to split into given/family.
    people = [{ given: "", family: raw }];
  }

  return people.map((p, i) => ({
    ...p,
    sequence: i === 0 ? "first" : "additional",
  }));
}

/**
 * Normalize the authors on a looked-up paper and on every study in its record.
 * @template T
 * @param {T} paper
 * @returns {T}
 */
export function normalizePaperAuthors(paper) {
  if (!paper || typeof paper !== "object") return paper;
  const p = /** @type {any} */ (paper);
  p.authors = normalizeAuthors(p.authors);
  const record = p.record;
  if (record) {
    for (const key of ["replications", "originals", "reproductions"]) {
      if (Array.isArray(record[key])) {
        for (const item of record[key]) {
          if (item) item.authors = normalizeAuthors(item.authors);
        }
      }
    }
  }
  return paper;
}
