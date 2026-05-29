import { createSignal, createEffect, For, Show, onCleanup, onMount } from "solid-js";
import { parseReferences } from "../../utils/referenceParser";
import { lookupAll, type LookupResult } from "../../utils/doiLookup";

type Tab = "paste" | "upload";
type Stage = "input" | "processing" | "results";

type Props = {
  open: boolean;
  onClose: () => void;
  onSearch: (dois: string[]) => void;
};

const SourceBadge = (props: { source: LookupResult["source"] }) => {
  const map: Record<string, { label: string; cls: string }> = {
    direct:   { label: "DOI",       cls: "rim-badge-direct"   },
    crossref: { label: "CrossRef",  cls: "rim-badge-crossref" },
    openalex: { label: "OpenAlex",  cls: "rim-badge-openalex" },
    none:     { label: "Not found", cls: "rim-badge-none"     },
  };
  const info = () => map[props.source] ?? map.none;
  return <span class={`rim-badge ${info().cls}`}>{info().label}</span>;
};

export const ReferenceImportModal = (props: Props) => {
  const [tab, setTab] = createSignal<Tab>("paste");
  const [stage, setStage] = createSignal<Stage>("input");
  const [text, setText] = createSignal("");
  const [fileName, setFileName] = createSignal<string | null>(null);
  const [results, setResults] = createSignal<LookupResult[]>([]);
  const [progress, setProgress] = createSignal({ done: 0, total: 0 });
  const [error, setError] = createSignal<string | null>(null);
  const [dragOver, setDragOver] = createSignal(false);

  let abortController: AbortController | null = null;
  let fileInputRef: HTMLInputElement | undefined;

  const reset = () => {
    abortController?.abort();
    setTab("paste");
    setStage("input");
    setText("");
    setFileName(null);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    setError(null);
    setDragOver(false);
  };

  const handleClose = () => {
    reset();
    props.onClose();
  };

  createEffect(() => {
    if (!props.open) reset();
  });

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.open) handleClose();
  };
  onMount(() => window.addEventListener("keydown", handleKey));
  onCleanup(() => {
    window.removeEventListener("keydown", handleKey);
    abortController?.abort();
  });

  const loadFile = (file: File) => {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Only .txt files are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setText((e.target?.result as string) ?? "");
      setFileName(file.name);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  };

  const runExtraction = async () => {
    const raw = text().trim();
    if (!raw) { setError("Please enter or upload some text first."); return; }
    setError(null);

    const refs = parseReferences(raw);
    if (refs.length === 0) { setError("No references detected in the text."); return; }

    setStage("processing");
    setProgress({ done: 0, total: refs.length });

    abortController = new AbortController();
    const found = await lookupAll(
      refs,
      (done, total) => setProgress({ done, total }),
      abortController.signal,
    );

    setResults(found);
    setStage("results");
  };

  const toggleResult = (index: number) => {
    setResults((prev) =>
      prev.map((r, i) =>
        i === index && r.status !== "not_found"
          ? { ...r, selected: !r.selected }
          : r,
      ),
    );
  };

  const selectedDois = () =>
    results()
      .filter((r) => r.selected && r.doi)
      .map((r) => r.doi!);

  const handleSearch = () => {
    const dois = selectedDois();
    if (dois.length === 0) return;
    props.onSearch(dois);
    handleClose();
  };

  const foundCount = () => results().filter((r) => r.status !== "not_found").length;
  const notFoundCount = () => results().filter((r) => r.status === "not_found").length;

  return (
    <Show when={props.open}>
      <div class="rim-backdrop" onClick={handleClose} role="presentation">
        <div
          class="rim-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Import References"
        >
          {/* Header */}
          <div class="rim-header">
            <div>
              <h2 class="rim-title">Import References</h2>
              <p class="rim-subtitle">
                Extract DOIs from a reference list — missing ones are looked up via CrossRef &amp; OpenAlex.
              </p>
            </div>
            <button class="rim-close" onClick={handleClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Input stage */}
          <Show when={stage() === "input"}>
            {/* Tab bar */}
            <div class="rim-tabs">
              <button
                class={`rim-tab ${tab() === "paste" ? "active" : ""}`}
                onClick={() => setTab("paste")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 2h6l2 2v2H7V4z" /><rect x="5" y="6" width="14" height="16" rx="1" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
                Paste text
              </button>
              <button
                class={`rim-tab ${tab() === "upload" ? "active" : ""}`}
                onClick={() => setTab("upload")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload .txt
              </button>
            </div>

            <div class="rim-body">
              <Show when={tab() === "paste"}>
                <textarea
                  class="rim-textarea"
                  placeholder={"Paste your reference list here…\n\nExamples:\n  10.1037/a0012345\n  Smith, J. (2020). Title. Journal, 10(2). https://doi.org/10.1037/a0012345\n  [1] Jones A. Title here. J. 2019;5:1–10."}
                  value={text()}
                  onInput={(e) => { setText(e.currentTarget.value); setError(null); }}
                  spellcheck={false}
                />
              </Show>

              <Show when={tab() === "upload"}>
                <div
                  class={`rim-dropzone ${dragOver() ? "drag-over" : ""} ${fileName() ? "has-file" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                  />
                  <Show
                    when={fileName()}
                    fallback={
                      <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="rim-drop-icon">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p class="rim-drop-label">Drop a .txt file here or <span class="rim-drop-link">click to browse</span></p>
                      </>
                    }
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="rim-drop-icon-ok">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p class="rim-drop-filename">{fileName()}</p>
                    <p class="rim-drop-change">Click to change file</p>
                  </Show>
                </div>

                <Show when={text() && fileName()}>
                  <p class="rim-file-preview-label">Preview</p>
                  <div class="rim-file-preview">{text().substring(0, 600)}{text().length > 600 ? "…" : ""}</div>
                </Show>
              </Show>

              <Show when={error()}>
                <p class="rim-error">{error()}</p>
              </Show>
            </div>

            <div class="rim-footer">
              <button class="rim-btn-ghost" onClick={handleClose}>Cancel</button>
              <button
                class="rim-btn-primary"
                onClick={runExtraction}
                disabled={!text().trim()}
              >
                Extract &amp; look up DOIs
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </Show>

          {/* Processing stage */}
          <Show when={stage() === "processing"}>
            <div class="rim-body rim-body-center">
              <div class="rim-progress-wrap">
                <div class="rim-spinner" />
                <p class="rim-progress-text">
                  Looking up DOIs… {progress().done} / {progress().total}
                </p>
                <div class="rim-progress-bar-track">
                  <div
                    class="rim-progress-bar-fill"
                    style={{
                      width: progress().total > 0
                        ? `${(progress().done / progress().total) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
                <p class="rim-progress-sub">Querying CrossRef and OpenAlex for unresolved references…</p>
              </div>
            </div>
            <div class="rim-footer">
              <button class="rim-btn-ghost" onClick={() => { abortController?.abort(); setStage("input"); }}>
                Cancel
              </button>
            </div>
          </Show>

          {/* Results stage */}
          <Show when={stage() === "results"}>
            <div class="rim-results-summary">
              <span class="rim-sum-item rim-sum-found">{foundCount()} resolved</span>
              <Show when={notFoundCount() > 0}>
                <span class="rim-sum-sep">·</span>
                <span class="rim-sum-item rim-sum-none">{notFoundCount()} not found</span>
              </Show>
              <span class="rim-sum-sep">·</span>
              <span class="rim-sum-hint">Uncheck any DOIs you want to exclude</span>
            </div>

            <div class="rim-results-list">
              <For each={results()}>
                {(result, i) => (
                  <div
                    class={`rim-result-row ${result.status === "not_found" ? "rim-row-none" : ""} ${result.selected ? "rim-row-selected" : ""}`}
                    onClick={() => toggleResult(i())}
                  >
                    <div class="rim-row-check">
                      <Show
                        when={result.status !== "not_found"}
                        fallback={
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        }
                      >
                        <div class={`rim-checkbox ${result.selected ? "checked" : ""}`}>
                          <Show when={result.selected}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </Show>
                        </div>
                      </Show>
                    </div>

                    <div class="rim-row-body">
                      <div class="rim-row-top">
                        <SourceBadge source={result.source} />
                        <Show when={result.doi}>
                          <code class="rim-row-doi">{result.doi}</code>
                        </Show>
                      </div>
                      <Show when={result.foundTitle}>
                        <p class="rim-row-title">{result.foundTitle}</p>
                      </Show>
                      <p class="rim-row-raw" title={result.ref.raw}>
                        {result.ref.raw.length > 120
                          ? result.ref.raw.substring(0, 120) + "…"
                          : result.ref.raw}
                      </p>
                      <Show when={result.status === "not_found"}>
                        <p class="rim-row-unresolved">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Couldn't find a DOI for this reference. Please look it up manually (e.g. on{" "}
                          <a href="https://search.crossref.org" target="_blank" rel="noopener">CrossRef</a>
                          {" "}or{" "}
                          <a href="https://openalex.org" target="_blank" rel="noopener">OpenAlex</a>
                          ) and add it to the search directly.
                        </p>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <div class="rim-footer">
              <button class="rim-btn-ghost" onClick={() => setStage("input")}>
                ← Back
              </button>
              <button
                class="rim-btn-primary"
                onClick={handleSearch}
                disabled={selectedDois().length === 0}
              >
                Search {selectedDois().length} paper{selectedDois().length !== 1 ? "s" : ""}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
                </svg>
              </button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
