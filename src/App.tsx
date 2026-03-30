import { createSignal, Show } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
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
  const navigate = useNavigate();
  const initialDoi = String(searchParams.doi || searchParams.dois || "");
  const initialQuery = String(searchParams.q || "");
  const initialTags = initialDoi
    ? initialDoi.split(",").map((d: string) => d.trim()).filter((d: string) => d !== "")
    : [];

  const [tags, setTags] = createSignal<string[]>(initialTags);
  const [inputValue, setInputValue] = createSignal(initialQuery);
  const [searchMode, setSearchMode] = createSignal<SearchMode>(
    initialQuery ? "fuzzy" : "doi"
  );
  const [results, setResults] = createSignal<Record<string, OriginalPaper>>({});
  const [selectedDoi, setSelectedDoi] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasSearched, setHasSearched] = createSignal(false);

  const syncUrl = (newTags: string[]) => {
    setSearchParams({ dois: newTags.length > 0 ? newTags.join(",") : undefined, q: undefined });
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
  };

  const handleResults = (res: DOIResults) => {
    const data = res.results || {};
    setResults(data);
    const keys = Object.keys(data);
    if (keys.length > 0) setSelectedDoi(keys[0]);
    setIsLoading(false);
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setInputValue("");
    setTags([]);
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

  // Auto-search if params are in URL
  if (initialTags.length > 0) doDoiSearch(initialTags);
  else if (initialQuery) doFuzzySearch(initialQuery);

  return (
    <>
      <TopBar
        tags={tags()}
        inputValue={inputValue()}
        searchMode={searchMode()}
        onInputChange={(v) => setInputValue(v)}
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
          onSelect={(doi) => setSelectedDoi(doi)}
          isLoading={isLoading()}
          hasSearched={hasSearched()}
        />

        <div class="right-panel">
          <Show when={selectedDoi()} fallback={
            <WelcomeState
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
          }>
            {(doi) => {
              const paper = () => results()[doi()];
              return (
                <Show
                  when={paper()?.record}
                  fallback={<NoDataState doi={doi()} />}
                >
                  <DetailView paper={paper()!} />
                </Show>
              );
            }}
          </Show>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default App;
