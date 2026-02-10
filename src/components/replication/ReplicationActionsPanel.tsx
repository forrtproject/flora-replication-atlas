import { createSignal, onCleanup } from "solid-js";
import type {FormattedDOIResult } from "../../@types";
import { CopyIcon } from "../icons/copy";
import { DNAIcon } from "../icons/dna";
import { DownloadIcon } from "../icons/download";
import { FlagIcon } from "../icons/flag";
import { ShareIcon } from "../icons/share";
import { UserGroupIcon } from "../icons/user-group";
type ReplicationActionsPanelProps = {
    data: FormattedDOIResult;
    onDownloadPdf?: () => void;
};
import { formatAuthors } from "../../utils/formatter";

export const ReplicationActionsPanel = (props: ReplicationActionsPanelProps) => {
    const [showToast, setShowToast] = createSignal(false);
    let toastTimer: number | undefined;

    const handleCopy = async () => {
        const text = [
            "Fortt Replication Studies",
            `Title: ${props.data.title || "Unknown"}`,
            `DOI: ${props.data.doi || "Unknown"}`,
            `Authors: ${formatAuthors(props.data.authors)}`,
        ].join("\n");

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            setShowToast(true);
            if (toastTimer) window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => setShowToast(false), 2000);
        }
    };

    onCleanup(() => {
        if (toastTimer) window.clearTimeout(toastTimer);
    });

    return (
        <div class="mt-8 border border-gray-200 no-print">
            <div class="navbar min-h-0 flex-wrap">
                <div class="navbar-start p-0 w-auto flex-1 flex-wrap">
                    <button class="btn btn-sm btn-ghost mr-2">
                        <UserGroupIcon className="w-5 h-5" />
                        <span>{props.data.authors?.length || 0}</span>
                        <span>{`Author${(props.data.authors?.length || 0) > 1 ? 's' : ''}`}</span>
                    </button>
                    <button class="btn btn-sm btn-ghost mr-2">
                        <DNAIcon className="w-5 h-5" />
                        <span>{props.data.replications?.length || 0}</span>
                        <span>{`Replication${(props.data.replications?.length || 0) > 1 ? 's' : ''}`}</span>
                    </button>
                </div>
                <div class="navbar-end p-0 gap-2 w-auto flex-1 flex-wrap">
                    <div class="relative inline-flex">
                        <button class="btn btn-sm" onClick={handleCopy}><CopyIcon className="w-5 h-5" /></button>
                        {showToast() ? (
                            <div class="absolute -top-10 right-0 z-50">
                                <div class="alert alert-success shadow-lg py-2 px-3 text-xs min-w-36">
                                    Copied to clipboard
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <a class="btn btn-sm" href={`https://pubpeer.com/search?q=${props.data.doi}`} target="_blank">
                        <ShareIcon className="w-5 h-5" />
                    </a>
                    <button class="btn btn-sm" onClick={props.onDownloadPdf} disabled={!props.onDownloadPdf}>
                        <DownloadIcon className="w-5 h-5" /> Download PDF
                    </button>
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