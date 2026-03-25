import { createSignal, createEffect, onCleanup } from "solid-js";
import type {FormattedDOIResult } from "../../@types";
import { CopyIcon } from "../icons/copy";
import { DNAIcon } from "../icons/dna";
import { DownloadIcon } from "../icons/download";
import { FlagIcon } from "../icons/flag";
import { ShareIcon } from "../icons/share";
import { UserGroupIcon } from "../icons/user-group";
import { fetchPdfUrl } from "../../api/unpaywall";
type ReplicationActionsPanelProps = {
    data: FormattedDOIResult;
};
import { formatAuthors } from "../../utils/formatter";
import { CopyLinkIcon } from "../icons/link-copy";

export const ReplicationActionsPanel = (props: ReplicationActionsPanelProps) => {
    const [showToast, setShowToast] = createSignal(false);
    const [showLinkCopyToast, setShowLinkCopyToast] = createSignal(false);
    const [pdfUrl, setPdfUrl] = createSignal<string | null>(null);
    const [pdfLoading, setPdfLoading] = createSignal(false);
    let toastTimer: number | undefined;

    createEffect(async () => {
        const doi = props.data.doi;
        if (!doi) {
            setPdfUrl(null);
            return;
        }
        setPdfUrl(null);
        try {
            const result = await fetchPdfUrl(doi);
            if (result.pdfUrl) {
                setPdfUrl(result.pdfUrl);
            }
        } catch {
            // No PDF available — button stays hidden
        }
    });

    const handleTextCopy = async () => {
        const text = [
            "Fortt Replication Studies",
            `Title: ${props.data.title || "Unknown"}`,
            `DOI: ${props.data.doi || "Unknown"}`,
            `Authors: ${formatAuthors(props.data.authors)}`,
        ].join("\n");
        handleCopy(text, setShowToast);
    }

    const handleLinkCopy = async () => {
        const url = `${window.location.origin}${window.location.pathname}?doi=${props.data.doi}`;
        await handleCopy(url, setShowLinkCopyToast);
    }

    const handleCopy = async (text: string, callback?: (arg?: boolean) => void) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            callback?.(true);
            if (toastTimer) window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => callback?.(false), 2000);
        }
    };

    const handleDownloadPdf = async () => {
        const url = pdfUrl();
        if (!url) return;

        setPdfLoading(true);
        try {
            const response = await fetch(url);
            const contentType = response.headers.get("content-type") || "";

            if (response.ok && contentType.includes("application/pdf")) {
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.download = `${props.data.title || props.data.doi || "paper"}.pdf`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(blobUrl);
            } else {
                // Response isn't a PDF (redirect/landing page) — open directly
                window.open(url, "_blank");
            }
        } catch {
            // CORS or network error — open directly as fallback
            window.open(url, "_blank");
        } finally {
            setPdfLoading(false);
        }
    };

    onCleanup(() => {
        if (toastTimer) window.clearTimeout(toastTimer);
    });

    return (
        <div class="mt-8 border border-gray-200 no-print">
            <div class="navbar min-h-0 flex-wrap">
                <div class="navbar-start p-0 w-auto flex-1 flex-wrap">
                    <button tabIndex={-1} class="btn btn-sm btn-ghost mr-2 pointer-events-none">
                        <UserGroupIcon className="w-5 h-5" />
                        <span>{props.data.authors?.length || 0}</span>
                        <span>{`Author${(props.data.authors?.length || 0) > 1 ? 's' : ''}`}</span>
                    </button>
                    <button tabIndex={-1} class="btn btn-sm btn-ghost mr-2 pointer-events-none">
                        <DNAIcon className="w-5 h-5" />
                        <span>{props.data.replications?.length || 0}</span>
                        <span>{`Replication${(props.data.replications?.length || 0) > 1 ? 's' : ''}`}</span>
                    </button>
                </div>
                <div class="navbar-end p-0 gap-2 w-auto flex-1 flex-wrap">
                    <div class="join">
                        <div class="relative inline-flex">
                            <button class="btn btn-sm join-item" onClick={handleTextCopy}><CopyIcon className="w-5 h-5" /></button>
                            {showToast() ? (
                                <div class="absolute -top-10 right-0 z-50">
                                    <div class="alert alert-success shadow-lg py-2 px-3 text-xs min-w-36">
                                        Copied to clipboard
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div class="relative inline-flex">
                            <button class="btn btn-sm join-item" onClick={handleLinkCopy}><CopyLinkIcon className="w-5 h-5" /></button>
                            {showLinkCopyToast() ? (
                                <div class="absolute -top-10 right-0 z-50">
                                    <div class="alert alert-success shadow-lg py-2 px-3 text-xs min-w-40">
                                        Url Copied to clipboard
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <a class="btn btn-sm join-item" href={`https://pubpeer.com/search?q=${props.data.doi}`} target="_blank">
                            <ShareIcon className="w-5 h-5" /> PubPeer
                        </a>
                    </div>
                    {pdfUrl() ? (
                        <button class="btn btn-sm" onClick={handleDownloadPdf} disabled={pdfLoading()}>
                            <DownloadIcon className="w-5 h-5" /> {pdfLoading() ? "Downloading..." : "Download PDF"}
                        </button>
                    ) : null}
                    <a class="btn btn-sm" href={`mailto:fred@forrt.org?subject=[Replication Flag] ${props.data.doi}&body=I would like to flag a potential issue in the replication record for:%0AOriginal DOI: ${props.data.doi}%0AReplication DOI: ${props.data.doi}%0AIssue details: [your comment here]`}>
                        <FlagIcon className="w-5 h-5" /> Flag Errors
                    </a>
                    <a class="btn btn-sm" href={`https://docs.google.com/forms/d/e/1FAIpQLSeMCwdtP0TPgL55stniuyyTxnNwyC34mO4VUuLcQwYrLI89sQ/viewform?usp=pp_url&entry.1234567890=${encodeURIComponent(props.data.doi || '')}`} target="_blank">
                        <FlagIcon className="w-5 h-5" /> Suggest Additions
                    </a>
                </div>
            </div>
        </div>
    )
};
