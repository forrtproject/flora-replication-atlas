import type { FormattedDOIResult, ReplicationItem } from "../@types";
import { formatAuthors } from "./formatter";

export type ExportEntry = {
  doi: string;
  isOriginal: boolean;
  isReplication: boolean;
  rep: FormattedDOIResult;
};

const PAGE_W = 210;
const MARGIN = 15;
const CW = PAGE_W - 2 * MARGIN;
const FOOTER_Y = 289;
const SAFE_BOTTOM = 270;
const BADGE_COL = 23;
const CONTENT_X = MARGIN + BADGE_COL;
const CONTENT_W = CW - BADGE_COL - 2; // -2mm safety margin against charSpace overflow

// Website brand colors
const COLOR_BRAND: [number, number, number] = [133, 57, 83];   // #853953
const COLOR_DARK: [number, number, number] = [17, 17, 17];
const COLOR_BODY: [number, number, number] = [75, 75, 75];
const COLOR_MUTED: [number, number, number] = [120, 120, 120];
const COLOR_SUBTLE: [number, number, number] = [160, 160, 160];
const COLOR_LINK: [number, number, number] = [37, 99, 235];

const outcomeLabel = (o: string | null | undefined): string => {
  if (!o) return "N/A";
  return o.charAt(0).toUpperCase() + o.slice(1);
};

export async function exportStudyListPdf(
  entries: ExportEntry[],
  filterLabel: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Reset text state that leaks between jsPDF operations (charSpace in particular)
  const resetText = () => doc.setCharSpace(0);

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

  let y = MARGIN + 5;

  const addPage = () => {
    doc.addPage();
    y = MARGIN + 5;
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
    resetText();
    doc.text(label, bx + 2, baselineY);
    resetText();
    return bw;
  };

  const outcomeBadgeStyle = (outcome: string | null | undefined) => {
    const lc = outcome?.toLowerCase() ?? "";
    if (lc === "successful")
      return { fill: [236, 253, 245] as [number, number, number], color: [22, 163, 74] as [number, number, number] };
    if (lc === "failed")
      return { fill: [254, 240, 238] as [number, number, number], color: [180, 35, 24] as [number, number, number] };
    return { fill: [254, 248, 232] as [number, number, number], color: [184, 134, 11] as [number, number, number] };
  };

  // ── Header ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_BRAND);
  resetText();
  doc.text(`FLoRA Replication Atlas — ${filterLabel}`, MARGIN, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  resetText();
  doc.text(summaryParts.join(" · "), MARGIN, y);
  y += 5;

  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;

  // ── Sub-item renderer ────────────────────────────────────
  const drawSubItems = (items: ReplicationItem[], sectionLabel: string) => {
    if (items.length === 0) return;

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_SUBTLE);
    resetText();
    doc.text(`${sectionLabel.toUpperCase()} ${items.length}`, MARGIN, y);
    y += 5;

    for (const item of items) {
      checkPageBreak(20);

      // Outcome badge — centered in the badge column
      const { fill, color } = outcomeBadgeStyle(item.outcome);
      const label = outcomeLabel(item.outcome).toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const tw = doc.getTextWidth(label);
      const bw = tw + 4;
      const bx = MARGIN + (BADGE_COL - bw) / 2;
      drawBadge(label, bx, y, fill, color);

      // Sub-item title — reset state and render lines individually
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_DARK);
      resetText();
      const subTitleLines: string[] = doc.splitTextToSize(
        item.title || "Untitled",
        CONTENT_W,
      );
      const titleStartY = y;
      for (let i = 0; i < subTitleLines.length; i++) {
        resetText();
        doc.text(subTitleLines[i], CONTENT_X, titleStartY + i * 5.5);
      }
      y += subTitleLines.length * 5.5;

      // Meta
      const authors = formatAuthors(item.authors);
      const meta = `${authors} (${item.year || "N/A"})${item.journal ? ` · ${item.journal}` : ""}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_BODY);
      resetText();
      const metaLines: string[] = doc.splitTextToSize(meta, CONTENT_W);
      for (let i = 0; i < metaLines.length; i++) {
        resetText();
        doc.text(metaLines[i], CONTENT_X, y + i * 4.5);
      }
      y += metaLines.length * 4.5;

      // DOI
      if (item.doi) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_LINK);
        resetText();
        doc.textWithLink(item.doi, CONTENT_X, y, {
          url: `https://doi.org/${item.doi}`,
        });
        resetText();
        y += 4.5;
      }

      y += 2;
    }
  };

  // ── Cards ────────────────────────────────────────────────
  for (const entry of entries) {
    const reps = entry.rep.replications ?? [];
    const origs = entry.rep.originals ?? [];

    let est = 0;
    if (entry.isOriginal || entry.isReplication) est += 6;
    est += 16;
    if (entry.rep.data?.journal) est += 5;
    est += 5;
    if (reps.length > 0) est += 5 + reps.length * 18;
    if (origs.length > 0) est += 5 + origs.length * 18;
    est += 8;
    checkPageBreak(Math.min(est, 45));

    // Type tags
    let tagX = MARGIN;
    if (entry.isOriginal) {
      tagX += drawBadge("ORIGINAL", tagX, y, [239, 246, 255], [37, 99, 235]) + 2;
    }
    if (entry.isReplication) {
      drawBadge("REPLICATION", tagX, y, [245, 243, 255], [124, 58, 237]);
    }
    if (entry.isOriginal || entry.isReplication) y += 6;

    // Card title — larger to stand out
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_DARK);
    resetText();
    const titleLines: string[] = doc.splitTextToSize(entry.rep.title || entry.doi, CW);
    for (let i = 0; i < titleLines.length; i++) {
      resetText();
      doc.text(titleLines[i], MARGIN, y + i * 7);
    }
    y += titleLines.length * 7;

    // Authors + Year
    const authorStr = `${formatAuthors(entry.rep.authors)} (${entry.rep.year ?? "N/A"})`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_BODY);
    resetText();
    doc.text(authorStr, MARGIN, y);
    y += 5;

    // Journal
    const journal = entry.rep.data?.journal;
    if (journal) {
      const vol = entry.rep.data?.volume ? ` ${entry.rep.data.volume}` : "";
      const iss = entry.rep.data?.issue ? `(${entry.rep.data.issue})` : "";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_MUTED);
      resetText();
      doc.text(`${journal}${vol}${iss}`, MARGIN, y);
      y += 5;
    }

    // Card DOI
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_LINK);
    resetText();
    doc.textWithLink(entry.doi, MARGIN, y, { url: `https://doi.org/${entry.doi}` });
    resetText();
    y += 5;

    drawSubItems(reps, "Replications");
    drawSubItems(origs, "Target Studies");

    y += 3;
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  }

  // ── Footers ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_SUBTLE);
    resetText();
    doc.text(
      "FLoRA Library · forrt.org/flora-replication-atlas/",
      PAGE_W / 2,
      FOOTER_Y,
      { align: "center" },
    );
    resetText();
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, FOOTER_Y, {
      align: "right",
    });
  }

  doc.save("flora-replication-atlas-export.pdf");
}
