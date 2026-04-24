import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import type { DOIResults, OriginalPaper } from "./@types";
import { fetchMultipleDOIInfo, fetchFuzzySearch } from "./api/backend";
import { TopBar, type SearchMode } from "./components/layout/TopBar";
import { StudyListPanel } from "./components/layout/StudyListPanel";
import {
  WelcomeState,
  exampleSearches,
} from "./components/layout/WelcomeState";
import { DetailView } from "./components/layout/DetailView";
import { NoDataState } from "./components/layout/NoDataState";
import { Footer } from "./components/Footer";

const isDoi = (s: string) => /^10\.\d{4,}\//.test(s.trim());

const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  call.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return call;
};

function App() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [tags, setTags] = createSignal<string[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [searchMode, setSearchMode] = createSignal<SearchMode>("doi");
  const [results, setResults] = createSignal<Record<string, OriginalPaper>>({});
  const [selectedDoi, setSelectedDoi] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasSearched, setHasSearched] = createSignal(false);

  const paperRefs: Record<string, HTMLDivElement> = {};
  let rightPanelRef: HTMLDivElement | undefined;
  let topbarInputRef: HTMLInputElement | undefined;
  let isScrollingFromClick = false;
  let scrollClickTimer: number | undefined;
  let observer: IntersectionObserver | undefined;
  let ignoreNextReset = false;
  let skipFuzzyEffect = false;
  let skipDoiEffect = false;

  const visibilityMap = new Map<string, number>();

  const pickActive = () => {
    if (isScrollingFromClick) return;
    if (!rightPanelRef) return;

    const panelTop = rightPanelRef.getBoundingClientRect().top;
    let best: { doi: string; distance: number } | null = null;

    for (const [doi, ratio] of visibilityMap) {
      if (ratio <= 0) continue;
      const el = paperRefs[doi];
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().top - panelTop);
      if (!best || dist < best.distance) {
        best = { doi, distance: dist };
      }
    }
    if (best) setSelectedDoi(best.doi);
  };

  const setupObserver = () => {
    if (observer) observer.disconnect();
    visibilityMap.clear();
    if (!rightPanelRef) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const doi = entry.target.getAttribute("data-doi");
          if (doi) visibilityMap.set(doi, entry.intersectionRatio);
        }
        pickActive();
      },
      { root: rightPanelRef, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    for (const [, el] of Object.entries(paperRefs)) {
      if (el) observer.observe(el);
    }
  };

  onCleanup(() => {
    if (observer) observer.disconnect();
    if (scrollClickTimer) window.clearTimeout(scrollClickTimer);
  });

  const scrollToPaper = (doi: string) => {
    setSelectedDoi(doi);
    isScrollingFromClick = true;
    if (scrollClickTimer) window.clearTimeout(scrollClickTimer);
    scrollClickTimer = window.setTimeout(() => {
      isScrollingFromClick = false;
    }, 800);
    const el = paperRefs[doi];
    if (el && rightPanelRef) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const syncUrl = (newTags: string[]) => {
    skipDoiEffect = true;
    setSearchParams({
      dois: newTags.length > 0 ? newTags.join(",") : undefined,
      q: undefined,
    });
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags().includes(trimmed)) {
      const newTags = [...tags(), trimmed];
      setTags(newTags);
      syncUrl(newTags);
    }
    setInputValue("");
  };

  const addTags = (incoming: string[]) => {
    const existing = new Set(tags());
    const deduped = incoming
      .map((t) => t.trim())
      .filter((t) => t && !existing.has(t));
    if (deduped.length === 0) return;
    const newTags = [...tags(), ...deduped];
    setTags(newTags);
    syncUrl(newTags);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    const newTags = tags().filter((_, i) => i !== index);
    setTags(newTags);
    syncUrl(newTags);
    if (newTags.length === 0) {
      debouncedDoiSearch.cancel();
      setResults({});
      setSelectedDoi(null);
    } else {
      debouncedDoiSearch(newTags);
    }
  };

  const handleResults = (res: DOIResults) => {
    const data = res.results || {};
    setResults(data);
    const keys = Object.keys(data);
    if (keys.length > 0) setSelectedDoi(keys[0]);
    setIsLoading(false);
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    const currentMode = searchMode();
    const currentInput = inputValue();
    const looksLikeDoi =
      /10\.\d{4,}/.test(currentInput) || currentInput.includes("doi.org/");
    setSearchMode(mode);
    if (currentMode === "doi" && looksLikeDoi) {
      setInputValue("");
    }
    setTags([]);
    setResults({});
    setSelectedDoi(null);
    if (hasSearched()) ignoreNextReset = true;
    setSearchParams({ q: undefined, dois: undefined });
  };

  const doDoiSearch = (dois: string[]) => {
    if (dois.length === 0) return;
    setIsLoading(true);
    setHasSearched(true);
    setResults({});
    setSelectedDoi(null);
    fetchMultipleDOIInfo(dois)
      .then(handleResults)
      .catch((error) => {
        console.error("Error fetching DOI info:", error);
        setIsLoading(false);
        setResults({});
      });
  };

  const doFuzzySearch = (query: string) => {
    if (!query) return;
    skipFuzzyEffect = true;
    setIsLoading(true);
    setHasSearched(true);
    setResults({});
    setSelectedDoi(null);
    setSearchParams({ q: query, dois: undefined });
    fetchFuzzySearch(query)
      .then(handleResults)
      .catch((error) => {
        console.error("Error in fuzzy search:", error);
        setIsLoading(false);
        setResults({});
      });
  };

  const debouncedFuzzySearch = debounce(
    (query: string) => doFuzzySearch(query),
    1000,
  );
  const debouncedDoiSearch = debounce(
    (dois: string[]) => doDoiSearch(dois),
    1000,
  );

  const doSearch = () => {
    if (searchMode() === "fuzzy") {
      doFuzzySearch(inputValue().trim());
    } else {
      doDoiSearch(tags());
    }
  };

  const handleExampleClick = (query: string) => {
    if (isDoi(query)) {
      setSearchMode("doi");
      setInputValue("");
      const newTags = [query.trim()];
      setTags(newTags);
      syncUrl(newTags);
      doDoiSearch(newTags);
    } else {
      setSearchMode("fuzzy");
      setTags([]);
      setInputValue(query);
      doFuzzySearch(query);
    }
  };

  // React to URL changes (e.g. browser back/forward)
  createEffect(() => {
    const doi = String(searchParams.doi || searchParams.dois || "");
    const q = String(searchParams.q || "");
    const currentTags = doi
      ? doi
          .split(",")
          .map((d: string) => d.trim())
          .filter((d: string) => d !== "")
      : [];

    if (currentTags.length > 0) {
      if (skipDoiEffect) {
        skipDoiEffect = false;
      } else {
        setTags(currentTags);
        setInputValue("");
        setSearchMode("doi");
        doDoiSearch(currentTags);
      }
    } else if (q) {
      if (skipFuzzyEffect) {
        skipFuzzyEffect = false;
      } else {
        setTags([]);
        setInputValue(q);
        setSearchMode("fuzzy");
        doFuzzySearch(q);
      }
    } else {
      // URL has no search params — reset to welcome state
      if (ignoreNextReset) {
        ignoreNextReset = false;
      } else {
        setTags([]);
        setInputValue("");
        setResults({});
        setSelectedDoi(null);
      }
    }
  });

  createEffect(() => {
    hasSearched();
    setTimeout(() => topbarInputRef?.focus(), 0);
  });

  return (
    <>
      <TopBar
        tags={tags()}
        inputValue={inputValue()}
        searchMode={searchMode()}
        showSearch={hasSearched()}
        onInputRef={(el) => (topbarInputRef = el)}
        onInputChange={(v) => {
          setInputValue(v);
          if (searchMode() === "fuzzy") {
            const q = v.trim();
            if (q === "") {
              debouncedFuzzySearch.cancel();
              if (tags().length === 0) {
                setResults({});
                setSelectedDoi(null);
                ignoreNextReset = true;
                setSearchParams({ q: undefined, dois: undefined });
              }
            } else {
              debouncedFuzzySearch(q);
            }
          }
        }}
        onAddTag={addTag}
        onAddTags={addTags}
        onRemoveTag={removeTag}
        onSearchSubmit={doSearch}
        onSearchModeChange={handleSearchModeChange}
        onNavigateSearch={(allTags) => {
          if (searchMode() === "fuzzy") {
            const query = allTags[0] || inputValue().trim();
            if (query) {
              setTags([]);
              setInputValue(query);
              doFuzzySearch(query);
            }
          } else if (allTags.length > 0) {
            setTags(allTags);
            setInputValue("");
            syncUrl(allTags);
            doDoiSearch(allTags);
          }
        }}
      />

      <div
        classList={{
          "main-layout": true,
          "no-sidebar": Object.keys(results()).length === 0,
        }}
      >
        <Show when={hasSearched() && Object.keys(results()).length > 0}>
          <StudyListPanel
            results={results()}
            selectedDoi={selectedDoi()}
            onSelect={(doi) => scrollToPaper(doi)}
            isLoading={isLoading()}
            hasSearched={hasSearched()}
          />
        </Show>

        <div class="right-panel" ref={rightPanelRef}>
          <Show
            when={Object.keys(results()).length > 0}
            fallback={
              <Show
                when={hasSearched()}
                fallback={
                  <WelcomeState
                    tags={tags()}
                    inputValue={inputValue()}
                    searchMode={searchMode()}
                    onInputChange={(v) => {
                      setInputValue(v);
                      if (searchMode() === "fuzzy") {
                        const q = v.trim();
                        if (q === "") debouncedFuzzySearch.cancel();
                        else debouncedFuzzySearch(q);
                      }
                    }}
                    onAddTag={addTag}
                    onAddTags={addTags}
                    onRemoveTag={removeTag}
                    onSearchSubmit={doSearch}
                    onSearchModeChange={handleSearchModeChange}
                    onExampleClick={handleExampleClick}
                  />
                }
              >
                <div class="suggestions-pane">
                  <div class="welcome-examples">
                    <div class="welcome-examples-label">Example searches</div>
                    {exampleSearches.map((ex) => (
                      <div
                        class="welcome-doi"
                        onClick={() => handleExampleClick(ex.query)}
                      >
                        <span>{ex.label}</span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <polyline points="9,18 15,12 9,6" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              </Show>
            }
          >
            <For each={Object.entries(results())}>
              {([doi, paper]) => (
                <div
                  data-doi={doi}
                  ref={(el) => {
                    paperRefs[doi] = el;
                    setupObserver();
                  }}
                  class={`scroll-paper-section ${selectedDoi() === doi ? "highlighted" : ""}`}
                >
                  <Show
                    when={paper?.record}
                    fallback={<NoDataState doi={doi} />}
                  >
                    <DetailView paper={paper!} />
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default App;
