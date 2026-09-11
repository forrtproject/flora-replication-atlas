import { CopyIcon as Copy, ExternalLinkIcon as ExternalLink } from "../icons";
import { createSignal, For } from "solid-js";
import { A } from "@solidjs/router";
import type { ReplicationItem } from "../../@types";
import { authorYearLine, normalizeOutcome } from "../../utils/formatter";

type ReplicationItemCardProps = {
  item: ReplicationItem;
  hideNa?: boolean;
  onCopyApa: (text: string) => void;
  onCopyBibtex: (text: string) => void;
};

type BadgeConfig = { label: string; cls: string };

// Reproductions record two judgements joined by a comma — how the computation went,
// then how robust the result was — and each gets its own tag.
const OUTCOME_PARTS: Record<string, BadgeConfig> = {
  "computationally reproducible": { label: "Comp. Reproducible", cls: "comp-success" },
  "computationally successful": { label: "Comp. Success", cls: "comp-success" },
  "computational issues": { label: "Comp. Issues", cls: "comp-issues" },
  "computation not checked": { label: "Comp. Not Checked", cls: "comp-unchecked" },
  robust: { label: "Robust", cls: "robust" },
  "robustness challenges": { label: "Rob. Challenges", cls: "rob-challenges" },
  "robustness not checked": { label: "Rob. Not Checked", cls: "rob-unchecked" },
  // Trailing half of "computational issues, not checked": robustness is what went unchecked.
  "not checked": { label: "Rob. Not Checked", cls: "rob-unchecked" },
};

const SIMPLE_OUTCOMES: Record<string, BadgeConfig> = {
  successful: { label: "Success", cls: "successful" },
  failed: { label: "Failed", cls: "failed" },
  mixed: { label: "Mixed", cls: "mixed" },
  partial: { label: "Partial", cls: "partial" },
};

function parseOutcomeBadges(outcome: string): BadgeConfig[] {
  // Shared normalization keeps badge matching in lockstep with formatter.ts
  // bucketing, so a card's badge never contradicts the aggregate counts.
  const normalized = normalizeOutcome(outcome);
  if (!normalized) return [{ label: "N/A", cls: "" }];
  if (SIMPLE_OUTCOMES[normalized]) return [SIMPLE_OUTCOMES[normalized]!];

  // Split the raw value, not the normalized one, so an unrecognized part keeps its
  // own capitalization when it falls through to the label.
  const parts = (outcome ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1)
    return parts.map((part) => {
      const key = normalizeOutcome(part);
      return (
        OUTCOME_PARTS[key] ?? SIMPLE_OUTCOMES[key] ?? { label: part, cls: "other" }
      );
    });

  // A non-empty but unrecognized outcome gets the "other" class so it survives the
  // hideNa filter; only a truly-empty outcome stays as the class-less "N/A" badge.
  return [OUTCOME_PARTS[normalized] ?? { label: (outcome ?? "").trim(), cls: "other" }];
}

const CopyIcon = () => (
  <Copy size={13} />
);

const ExternalLinkIcon = () => (
  <ExternalLink size={13} />
);

export const ReplicationItemCard = (props: ReplicationItemCardProps) => {
  const [expanded, setExpanded] = createSignal(false);
  const badges = () => parseOutcomeBadges(props.item.outcome);
  const meta = () =>
    [authorYearLine(props.item.authors, props.item.year), props.item.journal]
      .filter(Boolean)
      .join(" · ");

  const outcomeClass = () => badges()[0]?.cls || "none";
  /* The stored quote packs several extracts behind "||"; the first is the one
     the outcome label was read from. */
  const quote = () => (props.item.outcome_quote || "").split("||")[0]!.replace(/\s+/g, " ").trim();
  const LONG_QUOTE = 240;

  return (
    <div class={`rep-item rep-item--${outcomeClass()}`}>
      <div class="rep-item-main">
        <div class="ri-badge-group">
          <For each={badges().filter((b) => !(props.hideNa && !b.cls))}>
            {(b) => <span class={`ri-badge ${b.cls}`}>{b.label}</span>}
          </For>
        </div>
        <div class="ri-body">
          {props.item.title ? (
            <div class="ri-title">
              {/* A linked study usually has its own atlas page; link to it. */}
              {props.item.doi?.startsWith("10.") ? (
                <A href={`/doi/${props.item.doi}/`}>{props.item.title}</A>
              ) : (
                props.item.title
              )}
            </div>
          ) : null}
          {meta() ? <div class="ri-meta">{meta()}</div> : null}
          {props.item.doi ? (
            <a
              class="ri-doi"
              href={`https://doi.org/${props.item.doi}`}
              target="_blank"
              rel="noreferrer"
            >
              {props.item.doi}
            </a>
          ) : props.item.url ? (
            <a
              class="ri-doi"
              href={props.item.url}
              target="_blank"
              rel="noreferrer"
            >
              {props.item.url}
            </a>
          ) : null}
        </div>
        <div class="ri-actions">
          {props.item.apa_ref && (
            <button
              class="ri-action"
              title="Copy APA reference"
              onClick={() => props.onCopyApa(props.item.apa_ref)}
            >
              <CopyIcon /> APA
            </button>
          )}
          {props.item.bibtex_ref && (
            <button
              class="ri-action"
              title="Copy BibTeX citation"
              onClick={() => props.onCopyBibtex(props.item.bibtex_ref)}
            >
              <CopyIcon /> BibTeX
            </button>
          )}
          {(props.item.doi || props.item.url) && (
            <a
              class="ri-action"
              href={props.item.doi ? `https://doi.org/${props.item.doi}` : props.item.url!}
              target="_blank"
              rel="noreferrer"
              title="View paper"
            >
              <ExternalLinkIcon /> View
            </a>
          )}
        </div>
      </div>

      {quote() && (
        <figure class="ri-quote">
          <blockquote class="ri-quote-text">
            {expanded() || quote().length <= LONG_QUOTE
              ? quote()
              : `${quote().slice(0, LONG_QUOTE).trimEnd()}…`}
          </blockquote>
          <figcaption class="ri-quote-foot">
            <span>
              The passage this outcome was read from
              {props.item.outcome_quote_source
                ? `, in ${props.item.outcome_quote_source}`
                : ""}
            </span>
            {quote().length > LONG_QUOTE && (
              <button class="ri-quote-more" onClick={() => setExpanded(!expanded())}>
                {expanded() ? "Show less" : "Show full passage"}
              </button>
            )}
          </figcaption>
        </figure>
      )}
    </div>
  );
};
