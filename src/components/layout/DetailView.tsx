import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import type { OriginalPaper, ReplicationItem } from "../../@types";
import { formatReplicationResponse } from "../../api/formatter";
import { formatAuthors } from "../../utils/formatter";
import { MarkdownToHtml } from "../../utils/markdown";
import { ReplicationItemCard } from "./ReplicationItemCard";
import { fetchPdfUrl } from "../../api/unpaywall";

type DetailViewProps = {
  paper: OriginalPaper;
};

type TabId = "replications" | "reproductions" | "originals";

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15,3 21,3 21,9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const FlagIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

export const DetailView = (props: DetailViewProps) => {
  const [activeTab, setActiveTab] = createSignal<TabId>("replications");
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);
  const [pdfUrl, setPdfUrl] = createSignal<string | null>(null);
  let toastTimer: number | undefined;

  const rep = () => formatReplicationResponse(props.paper);

  onMount(async () => {
    const doi = props.paper.doi;
    if (!doi) return;
    try {
      const result = await fetchPdfUrl(doi);
      if (result.pdfUrl) setPdfUrl(result.pdfUrl);
    } catch {
      // No PDF available
    }
  });

  onCleanup(() => {
    if (toastTimer) window.clearTimeout(toastTimer);
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToastMessage(null), 2000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`);
    }
  };

  const handleCopyApa = () => {
    if (rep().apaRef) copyToClipboard(rep().apaRef!, "APA reference");
  };

  const handleCopyBibtex = () => {
    if (rep().bibtexRef) copyToClipboard(rep().bibtexRef!, "BibTeX citation");
  };

  const handleShareLink = () => {
    const base = import.meta.env.BASE_URL || "/";
    const url = `${window.location.origin}${base}doi/${props.paper.doi}`;
    copyToClipboard(url, "Share link");
  };

  const currentItems = (): ReplicationItem[] => {
    const r = rep();
    switch (activeTab()) {
      case "replications": return r.replications || [];
      case "reproductions": return r.reproductions || [];
      case "originals": return r.originals || [];
      default: return [];
    }
  };

  const outcomes = () => rep().outcomes;
  const total = () => outcomes()?.total || 0;
  const successPct = () => total() > 0 ? Math.round(((outcomes()?.success || 0) / total()) * 100) : 0;
  const mixedPct = () => total() > 0 ? Math.round((((outcomes()?.mixed || 0) + (outcomes()?.partial || 0)) / total()) * 100) : 0;
  const failedPct = () => total() > 0 ? 100 - successPct() - mixedPct() : 0;

  return (
    <div class="detail-wrap">
      <div class="detail-card">
        {/* Header */}
        <div class="dh">
          <h1 class="dh-title">{rep().title}</h1>
          <div class="dh-authors">
            {formatAuthors(rep().authors)} ({rep().year})
          </div>
          <Show when={rep().data?.journal}>
            <div class="dh-journal">
              {rep().data!.journal}
              {rep().data!.volume ? `, Vol ${rep().data!.volume}` : ""}
              {rep().data!.issue ? `, Issue ${rep().data!.issue}` : ""}
            </div>
          </Show>
          <Show when={rep().doi}>
            <a
              class="dh-doi-link"
              href={`https://doi.org/${rep().doi}`}
              target="_blank"
              rel="noreferrer"
            >
              {rep().doi}
            </a>
          </Show>

          <Show when={rep().apaRef}>
            <div class="dh-apa">
              <div class="dh-apa-label">APA Reference</div>
              <div class="dh-apa-text">
                <MarkdownToHtml text={rep().apaRef!} />
              </div>
            </div>
          </Show>
        </div>

        {/* Action bar */}
        <div class="action-bar">
          <div class="ab-group">
            <Show when={rep().doi}>
              <a
                class="ab-btn accent"
                href={`https://doi.org/${rep().doi}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon /> View Paper
              </a>
            </Show>
            <Show when={pdfUrl()}>
              <a class="ab-btn" href={pdfUrl()!} target="_blank" rel="noreferrer">
                <DownloadIcon /> PDF
              </a>
            </Show>
          </div>
          <div class="ab-sep" />
          <div class="ab-group">
            <Show when={rep().apaRef}>
              <button class="ab-btn" onClick={handleCopyApa} title="Copy APA reference">
                <CopyIcon /> Copy APA
              </button>
            </Show>
            <Show when={rep().bibtexRef}>
              <button class="ab-btn" onClick={handleCopyBibtex} title="Copy BibTeX citation">
                <CopyIcon /> Copy BibTeX
              </button>
            </Show>
            <button class="ab-btn" onClick={handleShareLink}>
              <LinkIcon /> Share Link
            </button>
          </div>
          <div class="ab-sep" />
          <div class="ab-group">
            <a
              class="ab-btn"
              href={`https://pubpeer.com/search?q=${rep().doi}`}
              target="_blank"
              rel="noreferrer"
            >
              PubPeer
            </a>
          </div>
        </div>

        {/* Progress bar */}
        <Show when={total() > 0}>
          <div class="progress-section">
            <div class="progress-row">
              <span class="progress-label">Outcome distribution</span>
              <div class="progress-track">
                <div class="progress-seg success" style={{ width: `${successPct()}%` }} />
                <div class="progress-seg mixed" style={{ width: `${mixedPct()}%` }} />
                <div class="progress-seg failed" style={{ width: `${failedPct()}%` }} />
              </div>
              <span class="progress-pct">{successPct()}% replicated</span>
            </div>
          </div>
        </Show>

        {/* Tabs */}
        <div class="tabs-bar">
          <button
            class={`tab-btn ${activeTab() === "replications" ? "active" : ""}`}
            onClick={() => setActiveTab("replications")}
          >
            Replications{" "}
            <span class="tab-badge">{rep().replications?.length || 0}</span>
          </button>
          <button
            class={`tab-btn ${activeTab() === "reproductions" ? "active" : ""}`}
            onClick={() => setActiveTab("reproductions")}
          >
            Reproductions{" "}
            <span class="tab-badge">{rep().reproductions?.length || 0}</span>
          </button>
          <button
            class={`tab-btn ${activeTab() === "originals" ? "active" : ""}`}
            onClick={() => setActiveTab("originals")}
          >
            Related Originals{" "}
            <span class="tab-badge">{rep().originals?.length || 0}</span>
          </button>
        </div>

        {/* Items list */}
        <div class="rep-list">
          <Show
            when={currentItems().length > 0}
            fallback={
              <div class="lp-empty" style={{ padding: "2rem" }}>
                <p>
                  No {activeTab()} found for this study.
                </p>
              </div>
            }
          >
            <For each={currentItems()}>
              {(item) => (
                <ReplicationItemCard
                  item={item}
                  onCopyApa={(text) => copyToClipboard(text, "APA reference")}
                  onCopyBibtex={(text) => copyToClipboard(text, "BibTeX citation")}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Contribute CTA */}
        <div class="contribute-bar">
          <div class="contribute-text">
            <strong>Know of a missing replication?</strong> Help keep FReD comprehensive.
          </div>
          <div class="contribute-btns">
            <a
              class="cb-btn primary"
              href={`https://docs.google.com/forms/d/e/1FAIpQLSeMCwdtP0TPgL55stniuyyTxnNwyC34mO4VUuLcQwYrLI89sQ/viewform?usp=pp_url&entry.1234567890=${encodeURIComponent(rep().doi || "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <PlusIcon /> Suggest Addition
            </a>
            <a
              class="cb-btn ghost"
              href={`mailto:fred@forrt.org?subject=[Replication Flag] ${rep().doi}&body=I would like to flag a potential issue in the replication record for:%0AOriginal DOI: ${rep().doi}%0AIssue details: [your comment here]`}
            >
              <FlagIcon /> Flag Error
            </a>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Show when={toastMessage()}>
        <div class="toast-msg">{toastMessage()}</div>
      </Show>
    </div>
  );
};
