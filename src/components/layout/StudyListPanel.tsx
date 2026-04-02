import { createSignal, For, Show } from "solid-js";
import type { OriginalPaper, FormattedDOIResult } from "../../@types";
import { formatReplicationResponse } from "../../api/formatter";
import { formatAuthors, renderAuthors, na } from "../../utils/formatter";

type TypeFilter = "all" | "original" | "replication";

type StudyListPanelProps = {
  results: Record<string, OriginalPaper>;
  selectedDoi: string | null;
  onSelect: (doi: string) => void;
  isLoading: boolean;
  hasSearched: boolean;
};

type OutcomeStatus = "failed" | "mixed" | "partial" | "successful" | "blank";

const resolveOverallStatus = (rep: FormattedDOIResult): OutcomeStatus => {
  if (!rep.outcomes?.total) return "blank";
  const vals = [
    { outcome: "successful" as OutcomeStatus, count: rep.outcomes.success || 0 },
    { outcome: "failed" as OutcomeStatus, count: rep.outcomes.failed || 0 },
    { outcome: "mixed" as OutcomeStatus, count: (rep.outcomes.mixed || 0) + (rep.outcomes.partial || 0) },
  ].filter((v) => v.count > 0);

  if (vals.length === 1) return vals[0].outcome;
  return "mixed";
};

const PrintIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

export const StudyListPanel = (props: StudyListPanelProps) => {
  const [typeFilter, setTypeFilter] = createSignal<TypeFilter>("all");

  const allEntries = () =>
    Object.entries(props.results).map(([doi, paper]) => {
      const rep = formatReplicationResponse(paper);
      const status = resolveOverallStatus(rep);
      const hasData = !!(rep.title && paper.record);
      const isOriginal = (rep.replications?.length || 0) > 0;
      const isReplication = (rep.originals?.length || 0) > 0;
      return { doi, paper, rep, status, hasData, isOriginal, isReplication };
    }).sort((a, b) => {
      if (a.hasData === b.hasData) return 0;
      return a.hasData ? -1 : 1;
    });

  const entries = () => {
    const filter = typeFilter();
    if (filter === "all") return allEntries();
    if (filter === "original") return allEntries().filter((e) => e.isOriginal);
    return allEntries().filter((e) => e.isReplication);
  };

  const totalCount = () => Object.keys(props.results).length;
  const originalCount = () => allEntries().filter((e) => e.isOriginal).length;
  const replicationCount = () => allEntries().filter((e) => e.isReplication).length;

  const handleExportPdf = () => {
    const visible = entries();
    if (visible.length === 0) return;

    const filterLabel = typeFilter() === "all" ? "All Studies" : typeFilter() === "original" ? "Original Studies" : "Replication Studies";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const outcomeLabel = (o: string | undefined) => {
      if (!o) return "N/A";
      return o.charAt(0).toUpperCase() + o.slice(1);
    };

    const renderSubItem = (r: any) => {
      const journal = r.journal ? `<span class="sep">&middot;</span><em>${esc(r.journal)}</em>` : "";
      const doi = r.doi ? `<div class="si-doi"><a href="https://doi.org/${r.doi}">${esc(r.doi)}</a></div>` : "";
      return `<div class="si">
        <span class="outcome ${r.outcome || ""}">${esc(outcomeLabel(r.outcome))}</span>
        <div class="si-body">
          <div class="si-title">${esc(r.title || "Untitled")}</div>
          <div class="si-meta">${esc(formatAuthors(r.authors))} (${r.year || "N/A"}) ${journal}</div>
          ${doi}
        </div>
      </div>`;
    };

    const cards = visible.map((entry) => {
      const tags: string[] = [];
      if (entry.isOriginal) tags.push('<span class="tag original">Original</span>');
      if (entry.isReplication) tags.push('<span class="tag replication">Replication</span>');

      const reps = entry.rep.replications || [];
      const origs = entry.rep.originals || [];

      const repSection = reps.length > 0 ? `
        <div class="section">
          <div class="section-head">Replications <span class="count">${reps.length}</span></div>
          ${reps.map(renderSubItem).join("")}
        </div>` : "";

      const origSection = origs.length > 0 ? `
        <div class="section">
          <div class="section-head">Target Studies <span class="count">${origs.length}</span></div>
          ${origs.map(renderSubItem).join("")}
        </div>` : "";

      const journal = entry.rep.data?.journal;
      const journalStr = journal
        ? `${esc(journal)}${entry.rep.data!.volume ? ` ${entry.rep.data!.volume}` : ""}${entry.rep.data!.issue ? `(${entry.rep.data!.issue})` : ""}`
        : "";

      return `<div class="card">
        <div class="card-head">
          <div class="row">
            <div class="tags">${tags.join("")}</div>
          </div>
          <div class="title">${esc(entry.rep.title || entry.doi)}</div>
          <div class="authors">${esc(formatAuthors(entry.rep.authors))} (${entry.rep.year || "N/A"})</div>
          ${journalStr ? `<div class="journal"><em>${journalStr}</em></div>` : ""}
          <div class="doi-row"><a href="https://doi.org/${entry.doi}">${esc(entry.doi)}</a></div>
        </div>
        ${repSection}${origSection}
      </div>`;
    }).join("");

    const totOrig = visible.filter((e) => e.isOriginal).length;
    const totRepl = visible.filter((e) => e.isReplication).length;
    const summaryParts: string[] = [];
    summaryParts.push(`${visible.length} ${visible.length === 1 ? "study" : "studies"}`);
    if (totOrig > 0) summaryParts.push(`${totOrig} original`);
    if (totRepl > 0) summaryParts.push(`${totRepl} replication`);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FReD Export — ${esc(filterLabel)}</title>
<style>
@page { margin: 1.5cm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Georgia, "Times New Roman", serif;
  color: #222; line-height: 1.55; max-width: 780px; margin: 0 auto; padding: 2rem 1.5rem;
}

/* Header */
header { margin-bottom: 1.8rem; }
header h1 { font-size: 22px; font-weight: 700; color: #853953; letter-spacing: -0.3px; }
header .sub { font-size: 12px; color: #777; margin-top: 0.2rem; font-family: -apple-system, "Segoe UI", sans-serif; }
header .sub span { color: #999; }

/* Card */
.card { border-bottom: 1px solid #e5e7eb; padding: 1rem 0; page-break-inside: avoid; }
.card:last-child { border-bottom: none; }
.card-head { margin-bottom: 0.1rem; }

.row { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
.tags { display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap; }
.tsep { width: 1px; height: 11px; background: #ccc; margin: 0 0.15rem; }
.tag { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 0.1rem 0.45rem; border-radius: 3px; }
.tag.original { background: #eff6ff; color: #2563eb; }
.tag.replication { background: #f5f3ff; color: #7c3aed; }
.pill { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 9px; padding: 0.08rem 0.4rem; border-radius: 100px; font-weight: 600; }
.pill.s { background: #ecfdf5; color: #16a34a; }
.pill.m { background: #fef8e8; color: #b8860b; }
.pill.f { background: #fef0ee; color: #b42318; }

.title { font-size: 15px; font-weight: 700; color: #111; line-height: 1.35; }
.authors { font-size: 12.5px; color: #555; font-family: -apple-system, "Segoe UI", sans-serif; margin-top: 0.1rem; }
.journal { font-size: 12px; color: #777; }
.doi-row { margin-top: 0.15rem; }
.doi-row a { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 11px; color: #2563eb; text-decoration: none; }

/* Sub-items */
.section { margin-top: 0.7rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0; }
.section-head { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #aaa; margin-bottom: 0.45rem; }
.count { font-weight: 400; }

.si { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.4rem 0; }
.si + .si { border-top: 1px solid #f5f5f5; }
.outcome { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 0.15rem 0.45rem; border-radius: 3px; white-space: nowrap; min-width: 58px; text-align: center; flex-shrink: 0; }
.outcome.successful { background: #ecfdf5; color: #16a34a; }
.outcome.failed { background: #fef0ee; color: #b42318; }
.outcome.mixed, .outcome.partial { background: #fef8e8; color: #b8860b; }
.si-body { flex: 1; min-width: 0; }
.si-title { font-size: 13px; font-weight: 600; color: #222; line-height: 1.35; }
.si-meta { font-size: 11.5px; color: #777; font-family: -apple-system, "Segoe UI", sans-serif; }
.si-meta .sep { margin: 0 0.25rem; color: #ccc; }
.si-doi a { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 10.5px; color: #2563eb; text-decoration: none; }

/* Footer */
footer { margin-top: 2rem; padding-top: 0.6rem; border-top: 1px solid #ddd; font-family: -apple-system, "Segoe UI", sans-serif; font-size: 10px; color: #bbb; text-align: center; }

@media print {
  body { padding: 0; }
  .doi-row a, .si-doi a { color: #2563eb; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; }
}
</style></head>
<body>
  <header>
    <h1>FReD &mdash; ${esc(filterLabel)}</h1>
    <div class="sub">${summaryParts.join(" <span>&middot;</span> ")} <span>&middot;</span> ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
  </header>
  ${cards}
  <footer>FORRT Replication Database &middot; forrt.org</footer>
</body></html>`;

    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(html);
    printWin.document.close();
    printWin.onload = () => printWin.print();
  };

  return (
    <div class="left-panel">
      <div class="lp-header">
        <h3>Search Results</h3>
        <div class="lp-header-actions">
          <Show when={totalCount() > 0}>
            <button class="lp-export-btn" onClick={handleExportPdf} title="Export to PDF">
              <PrintIcon /> Export
            </button>
          </Show>
          <Show when={totalCount() > 0}>
            <span class="lp-count">
              {totalCount()} {totalCount() === 1 ? "study" : "studies"}
            </span>
          </Show>
        </div>
      </div>

      <Show when={!props.isLoading && totalCount() > 0 && (originalCount() > 0 || replicationCount() > 0)}>
        <div class="sli-filter-bar">
          <button
            class={`sli-filter-btn ${typeFilter() === "all" ? "active" : ""}`}
            onClick={() => setTypeFilter("all")}
          >
            All <span class="sli-filter-count">{totalCount()}</span>
          </button>
          <Show when={originalCount() > 0}>
            <button
              class={`sli-filter-btn original ${typeFilter() === "original" ? "active" : ""}`}
              onClick={() => setTypeFilter("original")}
            >
              Original <span class="sli-filter-count">{originalCount()}</span>
            </button>
          </Show>
          <Show when={replicationCount() > 0}>
            <button
              class={`sli-filter-btn replication ${typeFilter() === "replication" ? "active" : ""}`}
              onClick={() => setTypeFilter("replication")}
            >
              Replication <span class="sli-filter-count">{replicationCount()}</span>
            </button>
          </Show>
        </div>
      </Show>

      <div class="study-list">
        <Show when={props.isLoading}>
          <div class="loading-panel">
            <div class="loading-spinner" />
            <span>Searching...</span>
          </div>
        </Show>

        <Show when={!props.isLoading && totalCount() === 0 && props.hasSearched}>
          <div class="lp-empty">
            <p>No results found. Check the DOI and try again.</p>
          </div>
        </Show>

        <Show when={!props.isLoading && totalCount() === 0 && !props.hasSearched}>
          <div class="lp-empty">
            <p>Enter a DOI above to search for replication studies.</p>
          </div>
        </Show>

        <Show when={!props.isLoading && entries().length > 0}>
          <For each={entries()}>
            {(entry) => (
              <div
                class={`sli ${props.selectedDoi === entry.doi ? "active" : ""}`}
                onClick={() => props.onSelect(entry.doi)}
              >
                <div class={`sli-dot ${entry.status}`} />
                <div class="sli-body">
                  <div class="sli-title">{entry.rep.title || entry.doi}</div>
                  <div class="sli-meta">
                    {renderAuthors(entry.rep.authors)} &middot; {entry.rep.year || na("Year")}
                  </div>
                  <div class="sli-pills">
                    <Show when={(entry.rep.replications?.length || 0) > 0}>
                      <span class="sli-pill sli-type-tag original">Original</span>
                    </Show>
                    <Show when={(entry.rep.originals?.length || 0) > 0}>
                      <span class="sli-pill sli-type-tag replication">Replication</span>
                    </Show>
                    <Show when={
                      ((entry.rep.replications?.length || 0) > 0 || (entry.rep.originals?.length || 0) > 0) &&
                      (entry.rep.outcomes?.total || 0) > 0
                    }>
                      <span class="sli-pills-sep" />
                    </Show>
                    <Show when={(entry.rep.outcomes?.success || 0) > 0}>
                      <span class="sli-pill s">{entry.rep.outcomes!.success} successful</span>
                    </Show>
                    <Show when={((entry.rep.outcomes?.mixed || 0) + (entry.rep.outcomes?.partial || 0)) > 0}>
                      <span class="sli-pill m">
                        {(entry.rep.outcomes!.mixed || 0) + (entry.rep.outcomes!.partial || 0)} mixed
                      </span>
                    </Show>
                    <Show when={(entry.rep.outcomes?.failed || 0) > 0}>
                      <span class="sli-pill f">{entry.rep.outcomes!.failed} failed</span>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
