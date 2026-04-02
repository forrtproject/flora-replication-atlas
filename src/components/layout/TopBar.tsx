import { For } from "solid-js";
import { A } from "@solidjs/router";
import forrt from "../../assets/FORRT.svg";

export type SearchMode = "doi" | "fuzzy";

type TopBarProps = {
  tags: string[];
  inputValue: string;
  searchMode: SearchMode;
  onInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  onSearchSubmit: () => void;
  onNavigateSearch?: (tags: string[]) => void;
  onSearchModeChange: (mode: SearchMode) => void;
};

export const TopBar = (props: TopBarProps) => {
  let inputRef: HTMLInputElement | undefined;

  const fireSearch = (extraTag?: string) => {
    const allTags = extraTag ? [...props.tags, extraTag] : [...props.tags];
    if (props.onNavigateSearch) {
      props.onNavigateSearch(allTags);
    } else {
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

    // Backspace on empty input removes the last tag
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
    if (pasted.includes(",")) {
      e.preventDefault();
      const parts = pasted
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      for (const part of parts) {
        props.onAddTag(part);
      }
    }
  };

  return (
    <nav class="topbar">
      <div class="topbar-left">
        <A class="topbar-brand" href="/">
          <div class="topbar-icon">
            <img
              src={forrt}
              alt="F"
              style={{ width: "20px", height: "20px" }}
            />
          </div>
          <div class="topbar-name">
            <strong>FLoRA</strong>
            <span>Replication Hub</span>
          </div>
        </A>
      </div>
      <div class="topbar-search" onClick={() => inputRef?.focus()}>
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
              e.stopPropagation();
              props.onSearchModeChange("doi");
            }}
          >
            DOI
          </button>
          <button
            classList={{ active: props.searchMode === "fuzzy" }}
            onClick={(e) => {
              e.stopPropagation();
              props.onSearchModeChange("fuzzy");
            }}
          >
            Keyword
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
            ref={inputRef}
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
            onPaste={handlePaste}
          />
        </div>
        <button
          class="topbar-search-btn"
          onClick={() => {
            const value = props.inputValue.trim();
            fireSearch(value || undefined);
          }}
        >
          Search
        </button>
      </div>
      <div class="topbar-right">
        <a
          class="topbar-link"
          href="https://forrt.org/replication-hub/"
          target="_blank"
        >
          About
        </a>
        <a
          class="topbar-link"
          href="https://forrt.org/apps/fred_explorer.html"
          target="_blank"
        >
          FReD Explorer
        </a>
      </div>
    </nav>
  );
};
