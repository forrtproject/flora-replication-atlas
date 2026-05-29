const DOI_RE = /\b(10\.\d{4,}\/[^\s"'<>[\]{}|\\^`]+)/g;

function cleanDoi(doi: string): string {
  return doi.replace(/[.,;)\]>]+$/, "");
}

export type ParsedReference = {
  raw: string;
  doi: string | null;
  queryText: string;
};

function extractDoiFromText(text: string): string | null {
  const re = new RegExp(DOI_RE.source, "g");
  const match = re.exec(text);
  return match ? cleanDoi(match[1]) : null;
}

function buildQueryText(ref: string): string {
  // Strip leading numbering: [1], 1., (1)
  let s = ref.replace(/^\s*[\[(]?\d+[\].)]\s*/, "");

  // Try APA-style: "Author (Year). Title. Journal..."
  const apaTitle = s.match(/\(\d{4}[a-z]?\)\.\s+([^.]{10,})\./);
  if (apaTitle) return apaTitle[1].trim();

  // Try to grab content after apparent author section (first comma or period block)
  // Heuristic: take the longest contiguous non-author fragment
  s = s.replace(/^[A-Z][^.]+\.\s+/, ""); // strip leading "Author, A.B." chunk
  return s.substring(0, 250).trim();
}

// Returns true if a line looks like the start of a new reference entry.
function looksLikeRefStart(line: string): boolean {
  // Numbered: [1], 1., 1)
  if (/^[\[(]?\d+[\].)]\s+\S/.test(line)) return true;
  // APA-style: starts with Author, A. or Author, A., & ...
  if (/^[A-Z][a-záéíóú''-]+,\s+[A-Z]/.test(line)) return true;
  // Vancouver-style: starts with Author AB or LASTNAME A
  if (/^[A-Z][a-z]+ [A-Z]{1,3}[,\s]/.test(line)) return true;
  // Starts with a year: 2020. Title...
  if (/^\d{4}\.\s+[A-Z]/.test(line)) return true;
  return false;
}

export function splitIntoReferences(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const refs: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (current.trim()) {
        refs.push(current.trim());
        current = "";
      }
      continue;
    }

    // Numbered reference or detected ref-start while accumulating something different
    const startsNew =
      /^[\[(]?\d+[\].)]\s+\S/.test(trimmed) ||
      (current.trim() && looksLikeRefStart(trimmed));

    if (startsNew && current.trim()) {
      refs.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }

  if (current.trim()) refs.push(current.trim());

  const filtered = refs.filter((r) => r.length > 15);

  // Last-resort: if everything collapsed into one entry but there are multiple
  // substantial lines, treat each non-trivial line as its own reference.
  if (filtered.length <= 1) {
    const perLine = lines.map((l) => l.trim()).filter((l) => l.length > 20);
    if (perLine.length > 1) return perLine;
  }

  return filtered;
}

export function parseReferences(text: string): ParsedReference[] {
  // Fast path: text is just a list of raw DOIs (one per line / comma-separated)
  const doiOnlyLines = text
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^10\.\d{4,}\//.test(s));

  const rawRefs = splitIntoReferences(text);

  // If the whole text is raw DOIs and splitting gave nothing useful, use doi-only mode
  if (doiOnlyLines.length > 0 && rawRefs.length === 0) {
    return doiOnlyLines.map((doi) => ({
      raw: doi,
      doi: cleanDoi(doi),
      queryText: doi,
    }));
  }

  // If no reference-style entries, fall back to extracting every DOI in the text
  if (rawRefs.length === 0) {
    const all: string[] = [];
    const re = new RegExp(DOI_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) all.push(cleanDoi(m[1]));
    return [...new Set(all)].map((doi) => ({
      raw: doi,
      doi,
      queryText: doi,
    }));
  }

  return rawRefs.map((raw) => ({
    raw,
    doi: extractDoiFromText(raw),
    queryText: buildQueryText(raw),
  }));
}
