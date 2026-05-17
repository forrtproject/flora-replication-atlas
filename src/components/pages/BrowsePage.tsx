import {
  createSignal,
  createResource,
  createMemo,
  createEffect,
  Show,
  For,
  onCleanup,
} from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import {
  fetchFilterOptions,
  fetchRecords,
  type BrowseRecord,
  type BrowseFilters,
} from "../../api/backend";
import { TopBar, type SearchMode } from "../layout/TopBar";
import { Footer } from "../Footer";
import { formatAuthors } from "../../utils/formatter";

type RecordTypeFilter = "all" | "original" | "replication";

type FilterableSelectProps = {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

const MAX_DROPDOWN_RESULTS = 100;

const FilterableSelect = (props: FilterableSelectProps) => {
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  let wrapRef: HTMLDivElement | undefined;

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return props.options.slice(0, MAX_DROPDOWN_RESULTS);
    const out: string[] = [];
    for (const opt of props.options) {
      if (opt.toLowerCase().includes(q)) {
        out.push(opt);
        if (out.length >= MAX_DROPDOWN_RESULTS) break;
      }
    }
    return out;
  });

  const onDocClick = (e: MouseEvent) => {
    if (wrapRef && !wrapRef.contains(e.target as Node)) setOpen(false);
  };
  document.addEventListener("mousedown", onDocClick);
  onCleanup(() => document.removeEventListener("mousedown", onDocClick));

  const select = (opt: string) => {
    props.onChange(opt);
    setQuery("");
    setOpen(false);
  };

  const clear = (e: MouseEvent) => {
    e.stopPropagation();
    props.onChange("");
    setQuery("");
  };

  return (
    <div class="bp-filter" ref={wrapRef}>
      <label class="bp-filter-label">{props.label}</label>
      <div class="bp-select" classList={{ open: open() }}>
        <Show
          when={props.value && !open()}
          fallback={
            <input
              class="bp-select-input"
              type="text"
              placeholder={props.placeholder}
              value={query()}
              onFocus={() => setOpen(true)}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                setOpen(true);
              }}
            />
          }
        >
          <button
            type="button"
            class="bp-select-chip"
            onClick={() => setOpen(true)}
            title={props.value}
          >
            <span class="bp-select-chip-text">{props.value}</span>
            <span
              class="bp-select-chip-clear"
              role="button"
              aria-label="Clear filter"
              onClick={clear}
            >
              &times;
            </span>
          </button>
        </Show>
        <Show when={open()}>
          <div class="bp-select-menu">
            <Show
              when={filtered().length > 0}
              fallback={<div class="bp-select-empty">No matches</div>}
            >
              <For each={filtered()}>
                {(opt) => (
                  <button
                    type="button"
                    class="bp-select-item"
                    classList={{ active: opt === props.value }}
                    onClick={() => select(opt)}
                  >
                    {opt}
                  </button>
                )}
              </For>
              <Show
                when={
                  !query() && props.options.length > MAX_DROPDOWN_RESULTS
                }
              >
                <div class="bp-select-hint">
                  Showing first {MAX_DROPDOWN_RESULTS} of{" "}
                  {props.options.length.toLocaleString()} — type to filter
                </div>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

const formatOutcome = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1);

const recordDisplayAuthors = (r: BrowseRecord) => {
  if (r.authors && r.authors.length > 0) {
    return formatAuthors(r.authors);
  }
  return "Authors not available";
};

const recordOutcomes = (r: BrowseRecord) => {
  if (!r.outcomes) return [] as string[];
  return Object.values(r.outcomes).filter(Boolean);
};

const outcomeClass = (o: string) => {
  const v = o.toLowerCase();
  if (v.includes("successful") && !v.includes("flawed")) return "s";
  if (v === "failed") return "f";
  if (v.includes("mixed") || v.includes("partial")) return "m";
  return "n";
};

export const BrowsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    author?: string;
    journal?: string;
    outcome?: string;
    type?: RecordTypeFilter;
  }>();

  const author = () => searchParams.author || "";
  const journal = () => searchParams.journal || "";
  const outcome = () => searchParams.outcome || "";
  const typeFilter = (): RecordTypeFilter =>
    (searchParams.type as RecordTypeFilter) || "all";

  const updateParam = (key: string, value: string) => {
    setSearchParams({ [key]: value || undefined });
  };

  const [options] = createResource(fetchFilterOptions);

  const [records, setRecords] = createSignal<BrowseRecord[]>([]);
  const [cursor, setCursor] = createSignal<string | undefined>(undefined);
  const [hasMore, setHasMore] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const filterKey = () =>
    JSON.stringify({
      author: author(),
      journal: journal(),
      outcome: outcome(),
      type: typeFilter(),
    });

  const load = async (append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const filters: BrowseFilters = {};
    if (author()) filters.author = author();
    if (journal()) filters.journal = journal();
    if (outcome()) filters.outcome = outcome();
    if (typeFilter() !== "all") filters.type = typeFilter() as
      | "original"
      | "replication";
    if (append && cursor()) filters.cursor = cursor();

    try {
      const res = await fetchRecords(filters);
      setRecords((prev) => (append ? [...prev, ...res.results] : res.results));
      setCursor(res.next_cursor);
      setHasMore(!!res.next_cursor);
    } catch (e) {
      console.error("fetchRecords failed:", e);
      setError("Failed to load records. Please try again.");
      if (!append) setRecords([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  createEffect(() => {
    filterKey();
    setCursor(undefined);
    load(false);
  });

  const clearAllFilters = () => {
    setSearchParams({
      author: undefined,
      journal: undefined,
      outcome: undefined,
      type: undefined,
    });
  };

  const activeFilterCount = () => {
    let n = 0;
    if (author()) n++;
    if (journal()) n++;
    if (outcome()) n++;
    if (typeFilter() !== "all") n++;
    return n;
  };

  // TopBar plumbing — clicking submit/search navigates back to home with the query.
  const [searchMode, setSearchMode] = createSignal<SearchMode>("fuzzy");
  const [tags, setTags] = createSignal<string[]>([]);
  const [inputValue, setInputValue] = createSignal("");

  const navigateSearch = (allTags: string[]) => {
    if (searchMode() === "fuzzy") {
      const q = allTags[0] || inputValue().trim();
      if (q) window.location.assign(`/?q=${encodeURIComponent(q)}`);
    } else if (allTags.length === 1) {
      window.location.assign(`/doi/${allTags[0]}`);
    } else if (allTags.length > 1) {
      window.location.assign(`/?dois=${allTags.join(",")}`);
    }
  };

  return (
    <>
      <TopBar
        tags={tags()}
        inputValue={inputValue()}
        searchMode={searchMode()}
        showSearch={false}
        onInputChange={setInputValue}
        onAddTag={(t) => setTags([...tags(), t])}
        onRemoveTag={(i) => setTags(tags().filter((_, idx) => idx !== i))}
        onSearchSubmit={() => navigateSearch(tags())}
        onSearchModeChange={setSearchMode}
        onNavigateSearch={navigateSearch}
      />

      <div class="browse-page">
        <aside class="bp-sidebar">
          <div class="bp-sidebar-head">
            <h2>Browse Data</h2>
            <Show when={activeFilterCount() > 0}>
              <button
                class="bp-clear-all"
                type="button"
                onClick={clearAllFilters}
              >
                Clear all ({activeFilterCount()})
              </button>
            </Show>
          </div>

          <div class="bp-filter">
            <label class="bp-filter-label">Record type</label>
            <div class="bp-type-toggle">
              <button
                type="button"
                classList={{ active: typeFilter() === "all" }}
                onClick={() => updateParam("type", "")}
              >
                All
              </button>
              <button
                type="button"
                classList={{ active: typeFilter() === "original" }}
                onClick={() => updateParam("type", "original")}
              >
                Original
              </button>
              <button
                type="button"
                classList={{ active: typeFilter() === "replication" }}
                onClick={() => updateParam("type", "replication")}
              >
                Replication
              </button>
            </div>
          </div>

          <Show
            when={!options.loading && options()}
            fallback={
              <div class="bp-filter-skeleton">Loading filters…</div>
            }
          >
            <FilterableSelect
              label="Author"
              placeholder="Search authors…"
              options={options()!.authors}
              value={author()}
              onChange={(v) => updateParam("author", v)}
            />
            <FilterableSelect
              label="Journal"
              placeholder="Search journals…"
              options={options()!.journals}
              value={journal()}
              onChange={(v) => updateParam("journal", v)}
            />
            <FilterableSelect
              label="Outcome"
              placeholder="Select an outcome…"
              options={options()!.outcomes}
              value={outcome()}
              onChange={(v) => updateParam("outcome", v)}
            />
          </Show>
        </aside>

        <main class="bp-results">
          <div class="bp-results-head">
            <div class="bp-results-title">
              <Show
                when={!loading()}
                fallback={<span>Loading results…</span>}
              >
                <Show
                  when={records().length > 0}
                  fallback={<span>No results</span>}
                >
                  <strong>{records().length.toLocaleString()}</strong>
                  <span> {records().length === 1 ? "record" : "records"}</span>
                  <Show when={hasMore()}>
                    <span class="bp-results-more"> (more available)</span>
                  </Show>
                </Show>
              </Show>
            </div>
          </div>

          <Show when={error()}>
            <div class="bp-error">{error()}</div>
          </Show>

          <Show
            when={!loading()}
            fallback={
              <div class="bp-loading">
                <div class="loading-spinner loading-spinner--lg" />
              </div>
            }
          >
            <Show
              when={records().length > 0}
              fallback={
                <div class="bp-empty">
                  <p>No records match the selected filters.</p>
                  <Show when={activeFilterCount() > 0}>
                    <button
                      class="bp-clear-all"
                      type="button"
                      onClick={clearAllFilters}
                    >
                      Clear filters
                    </button>
                  </Show>
                </div>
              }
            >
              <ul class="bp-list">
                <For each={records()}>
                  {(r) => (
                    <li class="bp-card">
                      <A class="bp-card-link" href={`/doi/${r.doi}`}>
                        <div class="bp-card-tags">
                          <span class={`bp-tag ${r._type}`}>{r._type}</span>
                          <For each={recordOutcomes(r)}>
                            {(o) => (
                              <span
                                class={`bp-outcome ${outcomeClass(o)}`}
                                title={o}
                              >
                                {formatOutcome(o)}
                              </span>
                            )}
                          </For>
                        </div>
                        <div class="bp-card-title">
                          {r.title || r.doi}
                        </div>
                        <div class="bp-card-meta">
                          {recordDisplayAuthors(r)}
                          <Show when={r.year}>
                            <span> ({r.year})</span>
                          </Show>
                        </div>
                        <Show when={r.journal}>
                          <div class="bp-card-journal">
                            <em>{r.journal}</em>
                          </div>
                        </Show>
                        <div class="bp-card-doi">{r.doi}</div>
                      </A>
                    </li>
                  )}
                </For>
              </ul>

              <Show when={hasMore()}>
                <div class="bp-load-more-wrap">
                  <button
                    type="button"
                    class="bp-load-more"
                    disabled={loadingMore()}
                    onClick={() => load(true)}
                  >
                    {loadingMore() ? "Loading…" : "Load more"}
                  </button>
                </div>
              </Show>
            </Show>
          </Show>
        </main>
      </div>

      <Footer />
    </>
  );
};
