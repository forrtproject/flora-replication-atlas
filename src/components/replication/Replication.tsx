import type { Author } from "../../@types";
import { badgeBgs, bgs } from "../../configs";
import { MarkdownToHtml } from "../../utils/markdown";
import { BibtexToHtml } from "../../utils/bibtex";

type ReplicationProps = {
    title?: string | null;
    appaRef?: string | null;
    bibtexRef?: string | null;
    authors?: Author[] | null;
    outcome?: "failed" | "successful" | "partial" | "mixed" | "uninformative" | "blank";
    doi?: string | null;
    journal?: string | null;
    year?: number | null;
    volume?: string | null;
    issue?: string | null;
    pages?: string | null;
    outcomeQuote?: string | null;
    outcomeQuoteSource?: string | null;
    kind?: "replication" | "reproduction" | "original";
};

const MetadataRow = (props: ReplicationProps) => (
    <div class="text-xs text-neutral/70 flex flex-wrap gap-2">
        {props.journal ? <span>{props.journal}</span> : null}
        {props.year ? <span>{props.year}</span> : null}
        {props.volume ? <span>Vol {props.volume}</span> : null}
        {props.issue ? <span>Issue {props.issue}</span> : null}
        {props.pages ? <span>Pages {props.pages}</span> : null}
        {props.doi ? (
            <a class="link" href={`https://doi.org/${props.doi}`} target="_blank" rel="noreferrer">{props.doi}</a>
        ) : null}
    </div>
);

const DetailsPanel = (props: ReplicationProps) => (
    props.outcomeQuote || props.bibtexRef ? (
        <details class="rounded-md bg-base-200 p-3">
            <summary class="cursor-pointer text-xs font-semibold text-neutral/80">More details</summary>
            <div class="mt-3 flex flex-col gap-3 text-xs">
                {props.outcomeQuote ? (
                    <div>
                        <div class="font-semibold text-neutral/80">Outcome quote</div>
                        <p class="mt-1 whitespace-pre-wrap">{props.outcomeQuote}</p>
                        {props.outcomeQuoteSource ? (
                            <div class="mt-2 text-[11px] text-neutral/70">Source: {props.outcomeQuoteSource}</div>
                        ) : null}
                    </div>
                ) : null}
                {props.bibtexRef ? (
                    <div>
                        <div class="font-semibold text-xs text-neutral/80">BibTeX</div>
                        <div class="mt-2">
                            <BibtexToHtml text={props.bibtexRef} />
                        </div>
                    </div>
                ) : null}
            </div>
        </details>
    ) : null
);

export const Replication = (props: ReplicationProps) => {
    return props.authors ? (
        <div class={`flex p-4 rounded-md flex-col flex-1 ${bgs[props.outcome || 'mixed']}`}>
            <div class="flex flex-col gap-3">
                <div class="flex items-start gap-3">
                    <div class={`mt-2 ${badgeBgs[props.outcome || 'uninformative']} h-2 w-2 min-w-2 rounded-full`}></div>
                    <div class="flex flex-col gap-2 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-sm font-bold">{props.title}</h2>
                        </div>
                        <MetadataRow {...props} />
                        <p class="text-sm academic-text reference"><MarkdownToHtml text={props.appaRef || ''} /></p>
                    </div>
                </div>
                <DetailsPanel {...props} />
            </div>
        </div>
    ) : null;
}