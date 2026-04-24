import { For } from "solid-js";
import type { SearchMode } from "./TopBar";

type WelcomeStateProps = {
  tags: string[];
  inputValue: string;
  searchMode: SearchMode;
  onInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onAddTags?: (tags: string[]) => void;
  onRemoveTag: (index: number) => void;
  onSearchSubmit: () => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onExampleClick: (query: string) => void;
};

export const exampleSearches = [
  { label: "power posing", query: "power posing" },
  { label: "marshmallow test", query: "marshmallow test" },
  { label: "ego depletion", query: "ego depletion" },
  { label: "growth mindset", query: "growth mindset" },
  { label: "10.1177/0956797610383437", query: "10.1177/0956797610383437" },
  { label: "10.1037/0022-3514.54.5.768", query: "10.1037/0022-3514.54.5.768" },
];

export const WelcomeState = (props: WelcomeStateProps) => {
  let inputRef: HTMLInputElement | undefined;

  const fireSearch = (extraTag?: string) => {
    const allTags = extraTag ? [...props.tags, extraTag] : [...props.tags];
    if (props.searchMode === "fuzzy") {
      const query = allTags[0] || props.inputValue.trim();
      if (query) props.onSearchSubmit();
    } else if (allTags.length > 0) {
      if (extraTag) props.onAddTag(extraTag);
      setTimeout(() => props.onSearchSubmit(), 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const value = props.inputValue.trim();

    if (e.key === "," || e.key === "Enter") {
      if (value && e.key === "," && props.searchMode === "doi") {
        e.preventDefault();
        props.onAddTag(value);
        return;
      }
      if (e.key === "Enter") {
        fireSearch(value || undefined);
        return;
      }
    }

    if (
      e.key === "Backspace" &&
      props.inputValue === "" &&
      props.tags.length > 0
    ) {
      props.onRemoveTag(props.tags.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    if (props.searchMode !== "doi") return;
    const pasted = e.clipboardData?.getData("text") || "";
    if (pasted.includes(",") || pasted.includes("\n")) {
      e.preventDefault();
      const parts = pasted
        .split(/[\n\r,]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (props.onAddTags) {
        props.onAddTags(parts);
      } else {
        for (const part of parts) {
          props.onAddTag(part);
        }
      }
    }
  };

  return (
    <div class="welcome-state">
      <div class="welcome-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#853953"
          stroke-width="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>
      <h1>Has this study been replicated?</h1>
      <p>
        Search by title, author, or DOI to see replication outcomes, related
        studies, and more.
      </p>

      <div class="welcome-search" onClick={() => inputRef?.focus()}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <div class="search-mode-toggle">
          <button
            classList={{ active: props.searchMode === "doi" }}
            onClick={(e) => {
              inputRef?.focus();
              e.stopPropagation();
              props.onSearchModeChange("doi");
            }}
          >
            DOI
          </button>
          <button
            classList={{ active: props.searchMode === "fuzzy" }}
            onClick={(e) => {
              inputRef?.focus();
              e.stopPropagation();
              props.onSearchModeChange("fuzzy");
            }}
          >
            Author / Title / Year
          </button>
        </div>
        <div class="tag-input-wrap">
          {props.searchMode === "doi" && (
            <For each={props.tags}>
              {(tag, i) => (
                <span class="search-tag">
                  {tag}
                  <button
                    class="search-tag-remove"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onRemoveTag(i());
                    }}
                  >
                    &times;
                  </button>
                </span>
              )}
            </For>
          )}
          <input
            ref={(el) => {
              inputRef = el;
              el.focus();
            }}
            type="text"
            placeholder={
              props.searchMode === "doi"
                ? props.tags.length === 0
                  ? "Search by DOI…"
                  : "Add another DOI…"
                : "Search by title, author, or year…"
            }
            value={props.inputValue}
            onInput={(e) => props.onInputChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            on:paste={handlePaste}
          />
        </div>
        <button
          class="welcome-search-btn"
          onClick={() => {
            const value = props.inputValue.trim();
            fireSearch(value || undefined);
          }}
        >
          Search
        </button>
      </div>

      <div class="welcome-examples">
        <div class="welcome-examples-label">Example searches</div>
        {exampleSearches.map((ex) => (
          <div
            class="welcome-doi"
            onClick={() => props.onExampleClick(ex.query)}
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
      <p class="welcome-footnote">
        Powered by FORRT's Library of Reproduction and Replication Attempts
        (FLoRA), the Replication Atlas covers 1,600+ original findings paired
        with replication outcomes across research disciplines.
      </p>
    </div>
  );
};
