import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import forrt from "../../assets/FORRT.svg";

export type SearchMode = "doi" | "fuzzy";

type TopBarProps = {
  tags: string[];
  inputValue: string;
  searchMode: SearchMode;
  showSearch?: boolean;
  onInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onAddTags?: (tags: string[]) => void;
  onRemoveTag: (index: number) => void;
  onSearchSubmit: () => void;
  onNavigateSearch?: (tags: string[]) => void;
  onSearchModeChange: (mode: SearchMode) => void;
};

export const TopBar = (props: TopBarProps) => {
  let inputRef: HTMLInputElement | undefined;
  let mobileInputRef: HTMLInputElement | undefined;
  const [menuOpen, setMenuOpen] = createSignal(false);

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

  const searchBar = (ref: (el: HTMLInputElement) => void) => (
    <>
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
          ref={ref}
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
        class="topbar-search-btn"
        onClick={() => {
          const value = props.inputValue.trim();
          fireSearch(value || undefined);
        }}
      >
        Search
      </button>
    </>
  );

  return (
    <div class="topbar-wrapper">
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
              <span>Replication Atlas</span>
            </div>
          </A>
        </div>
        <Show when={props.showSearch !== false}>
          <div
            class="topbar-search topbar-search-desktop"
            onClick={() => inputRef?.focus()}
          >
            {searchBar((el) => (inputRef = el))}
          </div>
        </Show>
        <div class="topbar-right topbar-right-desktop">
          <a
            class="topbar-link"
            href="https://forrt.org/replication-hub/"
            target="_blank"
            rel="noopener"
          >
            About
          </a>
          <a
            class="topbar-link"
            href="https://forrt.org/apps/fred_explorer.html"
            target="_blank"
            rel="noopener"
          >
            FReD Explorer
          </a>
          <a
            class="topbar-cta"
            href="https://docs.google.com/forms/d/e/1FAIpQLSeMCwdtP0TPgL55stniuyyTxnNwyC34mO4VUuLcQwYrLI89sQ/viewform"
            target="_blank"
            rel="noreferrer"
          >
            Add Missing Study
          </a>
        </div>
        <button
          class="topbar-hamburger"
          onClick={() => setMenuOpen(!menuOpen())}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            {menuOpen() ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <>
                <path d="M3 7h18" />
                <path d="M3 12h18" />
                <path d="M3 17h18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile search row — always visible on small screens */}
      <Show when={props.showSearch !== false}>
      <div class="topbar-mobile-search">
        <div class="mob-search-modes">
          <button
            classList={{ active: props.searchMode === "doi" }}
            onClick={() => props.onSearchModeChange("doi")}
          >
            DOI
          </button>
          <button
            classList={{ active: props.searchMode === "fuzzy" }}
            onClick={() => props.onSearchModeChange("fuzzy")}
          >
            Author / Title / Year
          </button>
        </div>
        <div class="mob-search-row" onClick={() => mobileInputRef?.focus()}>
          <svg
            class="mob-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <div class="mob-search-input-wrap">
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
              ref={(el) => (mobileInputRef = el)}
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
            class="mob-search-btn"
            onClick={() => {
              const value = props.inputValue.trim();
              fireSearch(value || undefined);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
        </div>
      </div>
      </Show>

      {/* Mobile nav menu */}
      {menuOpen() && (
        <div class="topbar-mobile-menu">
          <a
            class="topbar-mobile-link"
            href="https://forrt.org/replication-hub/"
            target="_blank"
            rel="noopener"
          >
            About
          </a>
          <a
            class="topbar-mobile-link"
            href="https://forrt.org/apps/fred_explorer.html"
            target="_blank"
            rel="noopener"
          >
            FReD Explorer
          </a>
          <a
            class="topbar-mobile-cta"
            href="https://docs.google.com/forms/d/e/1FAIpQLSeMCwdtP0TPgL55stniuyyTxnNwyC34mO4VUuLcQwYrLI89sQ/viewform"
            target="_blank"
            rel="noreferrer"
          >
            Add Missing Study
          </a>
        </div>
      )}
    </div>
  );
};
