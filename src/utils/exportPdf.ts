import type { FormattedDOIResult, ReplicationItem } from "../@types";
import { formatAuthors, NA_MARKER } from "./formatter";

export type ExportEntry = {
  doi: string;
  isOriginal: boolean;
  isReplication: boolean;
  rep: FormattedDOIResult;
};

const PAGE_W = 210;
const MARGIN = 15;
const CW = PAGE_W - 2 * MARGIN; // 180mm
const FOOTER_Y = 289;
const SAFE_BOTTOM = 271;

// Card geometry
const CARD_PAD_H = 5;    // horizontal padding inside card border
const CARD_PAD_TOP = 7;  // top padding inside card border
const CARD_PAD_BOT = 3;  // bottom padding inside card border
const CCX = MARGIN + CARD_PAD_H; // card content left: 20mm
const CCW = CW - CARD_PAD_H * 2; // card content width: 170mm

// Colors matched to CSS variables in index.css
const COLOR_BRAND: [number, number, number] = [133, 57, 83];    // --primary
const COLOR_DARK: [number, number, number] = [44, 44, 44];      // --text
const COLOR_BODY: [number, number, number] = [74, 74, 74];      // --text-secondary
const COLOR_MUTED: [number, number, number] = [136, 136, 136];  // --text-muted
const COLOR_SUBTLE: [number, number, number] = [170, 170, 170]; // --text-faint
const COLOR_LINK: [number, number, number] = [37, 99, 235];
const COLOR_BORDER_LIGHT: [number, number, number] = [224, 225, 225]; // --border-light

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, "");

const normalizeText = (s: string): string =>
  stripHtml(s)
    .replace(/ /g, " ")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim();

const safeAuthors = (raw: string): string => (raw === NA_MARKER ? "" : raw);

type PdfBadge = {
  label: string;
  fill: [number, number, number];
  color: [number, number, number];
};

const parsePdfBadges = (outcome: string | null | undefined): PdfBadge[] => {
  const lower = outcome?.toLowerCase() ?? "";
  const compMap: Record<string, PdfBadge> = {
    "computationally successful": { label: "COMP. SUCCESS",     fill: [240, 253, 244], color: [22, 163, 74]   },
    "computational issues":       { label: "COMP. ISSUES",      fill: [254, 240, 238], color: [180, 35, 24]   },
    "computation not checked":    { label: "COMP. NOT CHECKED", fill: [243, 244, 246], color: [107, 114, 128] },
  };
  const robMap: Record<string, PdfBadge> = {
    "robust":                  { label: "ROBUST",           fill: [240, 253, 244], color: [21, 128, 61]   },
    "robustness challenges":   { label: "ROB. CHALLENGES",  fill: [254, 248, 232], color: [184, 134, 11]  },
    "robustness not checked":  { label: "NOT CHECKED",      fill: [244, 244, 244], color: [136, 136, 136] },
  };
  for (const [ck, cb] of Object.entries(compMap)) {
    for (const [rk, rb] of Object.entries(robMap)) {
      if (lower === `${ck}, ${rk}`) return [cb, rb];
    }
  }
  if (lower === "successful") return [{ label: "SUCCESSFUL", fill: [236, 253, 245], color: [22, 163, 74]  }];
  if (lower === "failed")     return [{ label: "FAILED",     fill: [254, 240, 238], color: [180, 35, 24]  }];
  if (lower === "mixed" || lower === "partial")
    return [{ label: lower.toUpperCase(), fill: [254, 248, 232], color: [184, 134, 11] }];
  return [{ label: (outcome || "N/A").toUpperCase(), fill: [254, 248, 232], color: [184, 134, 11] }];
};

export async function exportStudyListPdf(
  entries: ExportEntry[],
  filterLabel: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Word-wrap using only getTextWidth — avoids splitTextToSize which sets
  // internal jsPDF state that causes text-justify stretching.
  const wrapText = (text: string, maxW: number): string[] => {
    const words = normalizeText(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) <= maxW) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  // Like wrapText but the first line has a narrower width (for inline badge+title layout).
  const wrapTextOffset = (text: string, firstW: number, restW: number): string[] => {
    const words = normalizeText(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const maxW = lines.length === 0 ? firstW : restW;
      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) <= maxW) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const totalStudies = entries.length;
  const totalOriginal = entries.filter((e) => e.isOriginal).length;
  const totalReplication = entries.filter((e) => e.isReplication).length;

  const summaryParts: string[] = [
    `${totalStudies} ${totalStudies === 1 ? "study" : "studies"}`,
  ];
  if (totalOriginal > 0) summaryParts.push(`${totalOriginal} original`);
  if (totalReplication > 0) summaryParts.push(`${totalReplication} replication`);
  summaryParts.push(
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );

  let y = MARGIN + 4;
  let currentPage = 1;
  let insideCard = false;

  const addPage = () => {
    if (insideCard) {
      const textY = Math.min(y + 3, SAFE_BOTTOM + CARD_PAD_BOT - 2);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_MUTED);
      doc.text("Continued on next page >>", CCX + CCW, textY, { align: "right" });
    }
    doc.addPage();
    currentPage++;
    y = MARGIN + CARD_PAD_TOP; // match card top padding on continuation pages
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > SAFE_BOTTOM) addPage();
  };

  const drawBadge = (
    label: string,
    bx: number,
    baselineY: number,
    fill: [number, number, number],
    color: [number, number, number],
  ): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const tw = doc.getTextWidth(label);
    const bw = tw + 4;
    doc.setFillColor(...fill);
    doc.roundedRect(bx, baselineY - 3.3, bw, 4.5, 1, 1, "F");
    doc.setTextColor(...color);
    doc.text(label, bx + 2, baselineY);
    return bw;
  };


  // Draws the card border retroactively. The border sits at the card edges
  // where there's padding, so it never overlaps text.
  const drawCardDecoration = (
    startPage: number,
    startY: number,
    endPage: number,
    endY: number,
  ) => {
    doc.setDrawColor(...COLOR_BORDER_LIGHT);
    doc.setLineWidth(0.3);
    if (startPage === endPage) {
      doc.setPage(startPage);
      doc.roundedRect(MARGIN, startY, CW, endY - startY, 2, 2, "S");
    } else {
      // Draw a partial border on each page the card spans
      for (let p = startPage; p <= endPage; p++) {
        doc.setPage(p);
        const top = p === startPage ? startY : MARGIN;
        const bottom = p === endPage ? endY : SAFE_BOTTOM + CARD_PAD_BOT;
        doc.roundedRect(MARGIN, top, CW, bottom - top, 2, 2, "S");
      }
    }
    doc.setLineWidth(0.2);
    doc.setPage(endPage);
  };

  // ── Header ──────────────────────────────────────────────
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_BRAND);
  doc.text("FLoRA Replication Atlas", MARGIN, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_DARK);
  doc.text(normalizeText(filterLabel), MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(summaryParts.join("  \xB7  "), MARGIN, y);
  y += 5;

  doc.setDrawColor(208, 209, 209);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setLineWidth(0.2);
  y += 8;

  // ── Sub-item renderer ────────────────────────────────────
  const drawSubItems = (items: ReplicationItem[], sectionLabel: string) => {
    if (items.length === 0) return;

    checkPageBreak(16);

    // Full-width rule. Card DOI advance is 5mm; DOI visual bottom is ~1mm below
    // its baseline, so y is already 4mm below DOI visual bottom — equal to the
    // 4mm we need below the line to the REPLICATIONS label top (~2mm above its baseline).
    doc.setDrawColor(...COLOR_BORDER_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + CW, y);
    doc.setLineWidth(0.2);
    y += 6; // 6mm to label baseline (label top = label_baseline - 2mm = y+4 → 4mm gap below line)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${sectionLabel.toUpperCase()}  ${items.length}`, CCX, y);
    y += 6;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      checkPageBreak(16);

      // Outcome badges (one or two) + title on same baseline
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const badges = parsePdfBadges(item.outcome);
      let badgeGroupW = 0;
      for (const badge of badges) {
        const bw = drawBadge(badge.label, CCX + badgeGroupW, y, badge.fill, badge.color);
        badgeGroupW += bw + 2;
      }
      badgeGroupW -= 2; // remove trailing gap

      const subTitleX = CCX + badgeGroupW + 2.5;
      const firstLineW = CCW - badgeGroupW - 2.5;
      doc.setFont("times", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_DARK);
      const subTitleLines = wrapTextOffset(item.title || "Untitled", firstLineW, CCW);
      doc.text(subTitleLines[0], subTitleX, y);
      for (let i = 1; i < subTitleLines.length; i++) {
        doc.text(subTitleLines[i], CCX, y + i * 5.5);
      }
      y += subTitleLines.length * 5.5 + 1;

      // Meta: authors (year) · journal
      const rawAuthors = formatAuthors(item.authors);
      const authorPart = safeAuthors(rawAuthors);
      const metaParts = [
        authorPart
          ? `${authorPart} (${item.year || "N/A"})`
          : item.year
            ? `(${item.year})`
            : null,
        item.journal ?? null,
      ].filter(Boolean);
      const meta = metaParts.join("  \xB7  ");
      if (meta) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR_MUTED);
        const metaLines = wrapText(meta, CCW);
        for (let i = 0; i < metaLines.length; i++) {
          doc.text(metaLines[i], CCX, y + i * 4.5);
        }
        y += metaLines.length * 4.5;
      }

      // DOI
      if (item.doi) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_LINK);
        doc.textWithLink(item.doi, CCX, y, {
          url: `https://doi.org/${item.doi}`,
        });
        y += 4.5;
      }

      // Hairline separator after item (not after the last one)
      if (idx < items.length - 1) {
        // DOI advance is 4.5mm; DOI visual bottom is ~1mm below baseline, so
        // current y is 3.5mm below DOI visual bottom. Draw line here, then
        // y += 6.8 so badge top (baseline - 3.3) is 3.5mm below line. Equal gaps.
        doc.setDrawColor(...COLOR_BORDER_LIGHT);
        doc.setLineWidth(0.2);
        doc.line(CCX, y, CCX + CCW, y);
        y += 6.8;
      } else {
        y += 4;
      }
    }
  };

  // ── Cards ────────────────────────────────────────────────
  for (const entry of entries) {
    const reps = entry.rep.replications ?? [];
    const repros = entry.rep.reproductions ?? [];
    const origs = entry.rep.originals ?? [];

    // Rough height estimate for page break decision
    let est = CARD_PAD_TOP + CARD_PAD_BOT + 13 + 4.5 + 4.5;
    if (entry.isOriginal || entry.isReplication) est += 5.5;
    if (entry.rep.data?.journal) est += 4.5;
    if (reps.length > 0) est += 7 + reps.length * 16;
    if (repros.length > 0) est += 7 + repros.length * 16;
    if (origs.length > 0) est += 7 + origs.length * 16;
    checkPageBreak(Math.min(est, 55));

    const cardStartPage = currentPage;
    const cardStartY = y;
    insideCard = true;
    y += CARD_PAD_TOP;

    // Type badges on their own line, left-aligned with the title
    let tagX = CCX;
    if (entry.isOriginal) {
      tagX += drawBadge("ORIGINAL", tagX, y, [239, 246, 255], [37, 99, 235]) + 2;
    }
    if (entry.isReplication) {
      drawBadge("REPLICATION", tagX, y, [245, 243, 255], [124, 58, 237]);
    }
    if (entry.isOriginal || entry.isReplication) y += 6.5;

    // Card title — starts at same CCX as the badges above
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLOR_DARK);
    const titleLines = wrapText(entry.rep.title || entry.doi, CCW);
    for (let i = 0; i < titleLines.length; i++) {
      doc.text(titleLines[i], CCX, y + i * 6.5);
    }
    y += titleLines.length * 6.5 + 1.5;

    // Authors + year
    const rawAuthors = formatAuthors(entry.rep.authors);
    const authorDisplay = safeAuthors(rawAuthors);
    const authorStr = authorDisplay
      ? `${authorDisplay} (${entry.rep.year ?? "N/A"})`
      : `(${entry.rep.year ?? "N/A"})`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_BODY);
    const authorLines = wrapText(authorStr, CCW);
    for (let i = 0; i < authorLines.length; i++) {
      doc.text(authorLines[i], CCX, y + i * 5);
    }
    y += authorLines.length * 5;

    // Journal
    const journal = entry.rep.data?.journal;
    if (journal) {
      const vol = entry.rep.data?.volume ? ` ${entry.rep.data.volume}` : "";
      const iss = entry.rep.data?.issue ? `(${entry.rep.data.issue})` : "";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(normalizeText(`${journal}${vol}${iss}`), CCX, y);
      y += 4.5;
    }

    // Card DOI
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_LINK);
    doc.textWithLink(entry.doi, CCX, y, { url: `https://doi.org/${entry.doi}` });
    y += 5;

    drawSubItems(reps, "Replications");
    drawSubItems(repros, "Reproductions");
    drawSubItems(origs, "Target Studies");

    y += CARD_PAD_BOT;
    const cardEndPage = currentPage;
    const cardEndY = y;

    insideCard = false;
    drawCardDecoration(cardStartPage, cardStartY, cardEndPage, cardEndY);

    y += 5; // gap between cards
  }

  // ── Footers ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_SUBTLE);
    doc.text(
      "FLoRA Library  \xB7  forrt.org/flora-replication-atlas/",
      PAGE_W / 2,
      FOOTER_Y,
      { align: "center" },
    );
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, FOOTER_Y, {
      align: "right",
    });
  }

  doc.save("flora-replication-atlas-export.pdf");
}
