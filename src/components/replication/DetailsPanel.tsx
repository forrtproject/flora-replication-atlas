import { BibtexToHtml } from "../../utils/bibtex";
import type { ReplicationProps } from "./types";

export const DetailsPanel = (props: ReplicationProps) => (
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