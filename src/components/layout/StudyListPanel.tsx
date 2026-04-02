import { For, Show } from "solid-js";
import type { OriginalPaper, FormattedDOIResult } from "../../@types";
import { formatReplicationResponse } from "../../api/formatter";
import { renderAuthors, na } from "../../utils/formatter";

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

export const StudyListPanel = (props: StudyListPanelProps) => {
  const entries = () =>
    Object.entries(props.results).map(([doi, paper]) => {
      const rep = formatReplicationResponse(paper);
      const status = resolveOverallStatus(rep);
      const hasData = !!(rep.title && paper.record);
      return { doi, paper, rep, status, hasData };
    }).sort((a, b) => {
      if (a.hasData === b.hasData) return 0;
      return a.hasData ? -1 : 1;
    });

  const totalCount = () => Object.keys(props.results).length;

  return (
    <div class="left-panel">
      <div class="lp-header">
        <h3>Search Results</h3>
        <Show when={totalCount() > 0}>
          <span class="lp-count">
            {totalCount()} {totalCount() === 1 ? "study" : "studies"}
          </span>
        </Show>
      </div>

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
