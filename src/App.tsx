import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import type { DOIResults, OriginalPaper } from "./@types";
import { fetchMultipleDOIInfo, fetchFuzzySearch } from "./api/backend";
import { TopBar, type SearchMode } from "./components/layout/TopBar";
import { StudyListPanel } from "./components/layout/StudyListPanel";
import { WelcomeState } from "./components/layout/WelcomeState";
import { DetailView } from "./components/layout/DetailView";
import { NoDataState } from "./components/layout/NoDataState";
import { Footer } from "./components/Footer";

const isDoi = (s: string) => /^10\.\d{4,}\//.test(s.trim());

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
  let isScrollingFromClick = false;
  let scrollClickTimer: number | undefined;
  let observer: IntersectionObserver | undefined;
  let ignoreNextReset = false;

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
    scrollClickTimer = window.setTimeout(() => { isScrollingFromClick = false; }, 800);
    const el = paperRefs[doi];
    if (el && rightPanelRef) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const syncUrl = (newTags: string[]) => {
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

  const removeTag = (index: number) => {
    const newTags = tags().filter((_, i) => i !== index);
    setTags(newTags);
    syncUrl(newTags);
    if (newTags.length === 0) {
      setResults({});
      setSelectedDoi(null);
      setHasSearched(false);
      setSearchParams({ dois: undefined, q: undefined });
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
    const looksLikeDoi = /10\.\d{4,}/.test(currentInput) || currentInput.includes("doi.org/");
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

  const doSearch = () => {
    if (searchMode() === "fuzzy") {
      doFuzzySearch(inputValue().trim());
    } else {
      doDoiSearch(tags());
    }
  };

  // React to URL changes (e.g. browser back/forward)
  createEffect(() => {
    const doi = String(searchParams.doi || searchParams.dois || "");
    const q = String(searchParams.q || "");
    const currentTags = doi
      ? doi.split(",").map((d: string) => d.trim()).filter((d: string) => d !== "")
      : [];

    if (currentTags.length > 0) {
      setTags(currentTags);
      setInputValue("");
      setSearchMode("doi");
      doDoiSearch(currentTags);
    } else if (q) {
      setTags([]);
      setInputValue(q);
      setSearchMode("fuzzy");
      doFuzzySearch(q);
    } else {
      // URL has no search params — reset to welcome state
      if (ignoreNextReset) {
        ignoreNextReset = false;
      } else {
        setTags([]);
        setInputValue("");
        setResults({});
        setSelectedDoi(null);
        setHasSearched(false);
      }
    }
  });

  return (
    <>
      <TopBar
        tags={tags()}
        inputValue={inputValue()}
        searchMode={searchMode()}
        showSearch={hasSearched()}
        onInputChange={(v) => {
          setInputValue(v);
          if (v.trim() === "" && searchMode() === "fuzzy" && tags().length === 0) {
            setResults({});
            setSelectedDoi(null);
            ignoreNextReset = true;
            setSearchParams({ q: undefined, dois: undefined });
          }
        }}
        onAddTag={addTag}
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

      <div class="main-layout">
        <StudyListPanel
          results={results()}
          selectedDoi={selectedDoi()}
          onSelect={(doi) => scrollToPaper(doi)}
          isLoading={isLoading()}
          hasSearched={hasSearched()}
        />

        <div class="right-panel" ref={rightPanelRef}>
          <Show
            when={Object.keys(results()).length > 0}
            fallback={
              <Show when={!hasSearched()}>
              <WelcomeState
                tags={tags()}
                inputValue={inputValue()}
                searchMode={searchMode()}
                onInputChange={(v) => setInputValue(v)}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                onSearchSubmit={doSearch}
                onSearchModeChange={handleSearchModeChange}
                onExampleClick={(query) => {
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
                }}
              />
              </Show>
            }
          >
            <For each={Object.entries(results())}>
              {([doi, paper]) => (
                <div
                  data-doi={doi}
                  ref={(el) => { paperRefs[doi] = el; setupObserver(); }}
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
