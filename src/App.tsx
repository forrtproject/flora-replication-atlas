import { createSignal, Show } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import type { DOIResults, OriginalPaper } from "./@types";
import { fetchMultipleDOIInfo } from "./api/backend";
import { TopBar } from "./components/layout/TopBar";
import { StudyListPanel } from "./components/layout/StudyListPanel";
import { WelcomeState } from "./components/layout/WelcomeState";
import { DetailView } from "./components/layout/DetailView";
import { NoDataState } from "./components/layout/NoDataState";
import { Footer } from "./components/Footer";

function App() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialDoi = String(searchParams.doi || searchParams.dois || "");
  const initialTags = initialDoi
    ? initialDoi.split(",").map((d: string) => d.trim()).filter((d: string) => d !== "")
    : [];

  const [tags, setTags] = createSignal<string[]>(initialTags);
  const [inputValue, setInputValue] = createSignal("");
  const [results, setResults] = createSignal<Record<string, OriginalPaper>>({});
  const [selectedDoi, setSelectedDoi] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasSearched, setHasSearched] = createSignal(false);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags().includes(trimmed)) {
      setTags([...tags(), trimmed]);
    }
    setInputValue("");
  };

  const removeTag = (index: number) => {
    setTags(tags().filter((_, i) => i !== index));
  };

  const doSearch = () => {
    const params = tags();
    if (params.length === 0) return;

    setIsLoading(true);
    setHasSearched(true);
    setResults({});
    setSelectedDoi(null);

    fetchMultipleDOIInfo(params)
      .then((res: DOIResults) => {
        if (res.isEmpty) {
          setResults({});
        } else {
          setResults(res.results || {});
          const keys = Object.keys(res.results || {});
          if (keys.length > 0) {
            setSelectedDoi(keys[0]);
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching DOI info:", error);
        setIsLoading(false);
        setResults({});
      });
  };

  // Auto-search if DOI is in URL
  if (initialTags.length > 0) {
    doSearch();
  }

  return (
    <>
      <TopBar
        tags={tags()}
        inputValue={inputValue()}
        onInputChange={(v) => setInputValue(v)}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSearchSubmit={doSearch}
        onNavigateSearch={(allTags) => {
          if (allTags.length === 1) {
            navigate(`/doi/${allTags[0]}`);
          } else if (allTags.length > 0) {
            setTags(allTags);
            setInputValue("");
            setTimeout(() => doSearch(), 0);
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
              onExampleClick={(doi) => {
                navigate(`/doi/${doi}`);
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
