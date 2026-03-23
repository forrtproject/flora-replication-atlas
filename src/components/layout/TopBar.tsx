import { For } from "solid-js";
import forrt from "../../assets/FORRT.svg";

type TopBarProps = {
  tags: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  onSearchSubmit: () => void;
};

export const TopBar = (props: TopBarProps) => {
  let inputRef: HTMLInputElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    const value = props.inputValue.trim();

    if (e.key === "," || e.key === "Enter") {
      if (value && e.key === ",") {
        e.preventDefault();
        props.onAddTag(value);
        return;
      }
      if (e.key === "Enter") {
        // If there's text in the input, add it as a tag first, then search
        if (value) {
          props.onAddTag(value);
        }
        // Small delay so the tag state updates before search fires
        setTimeout(() => props.onSearchSubmit(), 0);
        return;
      }
    }

    // Backspace on empty input removes the last tag
    if (e.key === "Backspace" && props.inputValue === "" && props.tags.length > 0) {
      props.onRemoveTag(props.tags.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const pasted = e.clipboardData?.getData("text") || "";
    if (pasted.includes(",")) {
      e.preventDefault();
      const parts = pasted.split(",").map((s) => s.trim()).filter((s) => s !== "");
      for (const part of parts) {
        props.onAddTag(part);
      }
    }
  };

  return (
    <nav class="topbar">
      <div class="topbar-left">
        <a class="topbar-brand" href="./">
          <div class="topbar-icon">
            <img src={forrt} alt="F" style={{ width: "20px", height: "20px" }} />
          </div>
          <div class="topbar-name">
            <strong>FReD</strong>
            <span>Replication Hub</span>
          </div>
        </a>
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
        <div class="tag-input-wrap">
          <For each={props.tags}>
            {(tag, i) => (
              <span class="search-tag">
                {tag}
                <button
                  class="search-tag-remove"
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
          <input
            ref={inputRef}
            type="text"
            placeholder={props.tags.length === 0 ? "Search by DOI — e.g. 10.1126/science.aac4716" : "Add another DOI..."}
            value={props.inputValue}
            onInput={(e) => props.onInputChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
        </div>
        <button class="topbar-search-btn" onClick={() => {
          const value = props.inputValue.trim();
          if (value) props.onAddTag(value);
          setTimeout(() => props.onSearchSubmit(), 0);
        }}>
          Search
        </button>
      </div>
      <div class="topbar-right">
        <a class="topbar-link" href="https://forrt.org/about/us/" target="_blank">
          About
        </a>
        <a class="topbar-link" href="https://forrt.org/apps/fred_explorer.html" target="_blank">
          FReD Explorer
        </a>
      </div>
    </nav>
  );
};
