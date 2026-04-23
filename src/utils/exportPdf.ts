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

  // ── Header ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(133, 57, 83);
  doc.text(`FLoRA Replication Atlas — ${filterLabel}`, MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(summaryParts.join(" · "), MARGIN, y);
  y += 5;

  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Sub-item renderer ────────────────────────────────────
  const drawSubItems = (items: ReplicationItem[], sectionLabel: string) => {
    if (items.length === 0) return;

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${sectionLabel.toUpperCase()} (${items.length})`, MARGIN, y);
    y += 5;

    for (const item of items) {
      checkPageBreak(18);

      const label = outcomeLabel(item.outcome);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const lc = item.outcome?.toLowerCase() ?? "";
      if (lc === "successful") {
        doc.setTextColor(22, 163, 74);
      } else if (lc === "failed") {
        doc.setTextColor(180, 35, 24);
      } else {
        doc.setTextColor(184, 134, 11);
      }
      const badge = `[${label}]`;
      doc.text(badge, MARGIN, y);
      const badgeW = doc.getTextWidth(badge) + 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(34, 34, 34);
      const subTitleLines = doc.splitTextToSize(item.title || "Untitled", CW - badgeW);
      doc.text(subTitleLines, MARGIN + badgeW, y);
      y += subTitleLines.length * 5;

      const authors = formatAuthors(item.authors);
      const meta = `${authors} (${item.year || "N/A"})${item.journal ? ` · ${item.journal}` : ""}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const metaLines = doc.splitTextToSize(meta, CW);
      doc.text(metaLines, MARGIN, y);
      y += metaLines.length * 4.5;

      if (item.doi) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(37, 99, 235);
        doc.textWithLink(item.doi, MARGIN, y, {
          url: `https://doi.org/${item.doi}`,
        });
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
    if (entry.isOriginal || entry.isReplication) est += 5;
    est += 14;
    if (entry.rep.data?.journal) est += 5;
    est += 5;
    if (reps.length > 0) est += 5 + reps.length * 16;
    if (origs.length > 0) est += 5 + origs.length * 16;
    est += 8;
    checkPageBreak(Math.min(est, 45));

    const tags: string[] = [];
    if (entry.isOriginal) tags.push("ORIGINAL");
    if (entry.isReplication) tags.push("REPLICATION");
    if (tags.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(tags.join("   "), MARGIN, y);
      y += 4.5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 17, 17);
    const titleLines = doc.splitTextToSize(entry.rep.title || entry.doi, CW);
    doc.text(titleLines, MARGIN, y);
    y += titleLines.length * 6;

    const authorStr = `${formatAuthors(entry.rep.authors)} (${entry.rep.year ?? "N/A"})`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(85, 85, 85);
    doc.text(authorStr, MARGIN, y);
    y += 5;

    const journal = entry.rep.data?.journal;
    if (journal) {
      const vol = entry.rep.data?.volume ? ` ${entry.rep.data.volume}` : "";
      const iss = entry.rep.data?.issue ? `(${entry.rep.data.issue})` : "";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text(`${journal}${vol}${iss}`, MARGIN, y);
      y += 5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(entry.doi, MARGIN, y, {
      url: `https://doi.org/${entry.doi}`,
    });
    y += 5;

    drawSubItems(reps, "Replications");
    drawSubItems(origs, "Target Studies");

    y += 3;
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  }

  // ── Footers ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(
      "FLoRA Library · forrt.org/flora-replication-atlas/",
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
