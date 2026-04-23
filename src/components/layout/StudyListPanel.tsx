import { createSignal, createEffect, For, Show } from "solid-js";
import type { OriginalPaper, FormattedDOIResult } from "../../@types";
import { formatReplicationResponse } from "../../api/formatter";
import { renderAuthors, na } from "../../utils/formatter";
import { exportStudyListPdf, type ExportEntry } from "../../utils/exportPdf";

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
    {
      outcome: "successful" as OutcomeStatus,
      count: rep.outcomes.success || 0,
    },
    { outcome: "failed" as OutcomeStatus, count: rep.outcomes.failed || 0 },
    {
      outcome: "mixed" as OutcomeStatus,
      count: (rep.outcomes.mixed || 0) + (rep.outcomes.partial || 0),
    },
  ].filter((v) => v.count > 0);

  if (vals.length === 1) return vals[0].outcome;
  return "mixed";
};

const PrintIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  >
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

export const StudyListPanel = (props: StudyListPanelProps) => {
  const [typeFilter, setTypeFilter] = createSignal<TypeFilter>("all");

  const allEntries = () =>
    Object.entries(props.results)
      .map(([doi, paper]) => {
        const rep = formatReplicationResponse(paper);
        const status = resolveOverallStatus(rep);
        const hasData = !!(rep.title && paper.record);
        const isOriginal = (rep.replications?.length || 0) > 0;
        const isReplication = (rep.originals?.length || 0) > 0;
        return { doi, paper, rep, status, hasData, isOriginal, isReplication };
      })
      .sort((a, b) => {
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
  const replicationCount = () =>
    allEntries().filter((e) => e.isReplication).length;

  const handleExportPdf = () => {
    const visible = entries();
    if (visible.length === 0) return;

    const filterLabel =
      typeFilter() === "all"
        ? "All Studies"
        : typeFilter() === "original"
          ? "Original Studies"
          : "Replication Studies";

    const exportEntries: ExportEntry[] = visible.map((e) => ({
      doi: e.doi,
      isOriginal: e.isOriginal,
      isReplication: e.isReplication,
      rep: e.rep,
    }));

    exportStudyListPdf(exportEntries, filterLabel);
  };

  return (
    <div class="left-panel">
      <div class="lp-header">
        <h3>Search Results</h3>
        <div class="lp-header-actions">
          <Show when={totalCount() > 0}>
            <button
              class="lp-export-btn"
              onClick={handleExportPdf}
              title="Export to PDF"
            >
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

      <Show
        when={
          !props.isLoading &&
          totalCount() > 0 &&
          (originalCount() > 0 || replicationCount() > 0)
        }
      >
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
              Replication{" "}
              <span class="sli-filter-count">{replicationCount()}</span>
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

        <Show
          when={!props.isLoading && totalCount() === 0 && props.hasSearched}
        >
          <div class="lp-empty">
            <p>No results found. Check the DOI and try again.</p>
          </div>
        </Show>

        <Show
          when={!props.isLoading && totalCount() === 0 && !props.hasSearched}
        >
          <div class="lp-empty">
            <p>Enter a DOI above to search for replication studies.</p>
          </div>
        </Show>

        <Show when={!props.isLoading && entries().length > 0}>
          <For each={entries()}>
            {(entry) => (
              <div
                class={`sli ${props.selectedDoi === entry.doi ? "active" : ""}`}
                ref={(el) => {
                  createEffect(() => {
                    if (props.selectedDoi === entry.doi) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }
                  });
                }}
                onClick={() => props.onSelect(entry.doi)}
              >
                <div class={`sli-dot ${entry.status}`} />
                <div class="sli-body">
                  <div class="sli-title">{entry.rep.title || entry.doi}</div>
                  <div class="sli-meta">
                    {renderAuthors(entry.rep.authors)} &middot;{" "}
                    {entry.rep.year || na("Year")}
                  </div>
                  <div class="sli-pills">
                    <Show when={(entry.rep.replications?.length || 0) > 0}>
                      <span class="sli-pill sli-type-tag original">
                        Original
                      </span>
                    </Show>
                    {/* <Show when={(entry.rep.originals?.length || 0) > 0}>
                      <span class="sli-pill sli-type-tag replication">Replication</span>
                    </Show> */}
                    <Show
                      when={
                        ((entry.rep.replications?.length || 0) > 0 ||
                          (entry.rep.originals?.length || 0) > 0) &&
                        (entry.rep.outcomes?.total || 0) > 0
                      }
                    >
                      <span class="sli-pills-sep" />
                    </Show>
                    <Show when={(entry.rep.outcomes?.success || 0) > 0}>
                      <span class="sli-pill s">
                        {entry.rep.outcomes!.success} successful
                      </span>
                    </Show>
                    <Show
                      when={
                        (entry.rep.outcomes?.mixed || 0) +
                          (entry.rep.outcomes?.partial || 0) >
                        0
                      }
                    >
                      <span class="sli-pill m">
                        {(entry.rep.outcomes!.mixed || 0) +
                          (entry.rep.outcomes!.partial || 0)}{" "}
                        mixed
                      </span>
                    </Show>
                    <Show when={(entry.rep.outcomes?.failed || 0) > 0}>
                      <span class="sli-pill f">
                        {entry.rep.outcomes!.failed} failed
                      </span>
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
