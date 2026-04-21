import type { ReplicationItem } from "../../@types";
import { Replication } from "./Replication";
import type { ReplicationProps } from "./types";

type SimpleOutcome = NonNullable<ReplicationProps["outcome"]>;

function normalizeOutcome(outcome: string | undefined): SimpleOutcome {
  const lower = (outcome ?? "").toLowerCase();
  if (lower.includes("computationally successful")) return "successful";
  if (lower.includes("computational issues")) return "failed";
  if (lower.includes("computation not checked")) return "uninformative";
  if (lower === "successful") return "successful";
  if (lower === "failed") return "failed";
  if (lower === "partial") return "partial";
  if (lower === "mixed") return "mixed";
  return "blank";
}

export const ReplicationSection = (props: { title: string; items: ReplicationItem[]; emptyMessage?: string }) => {
    if (props.items.length) {
        return (
            <div class="card border border-dashed rounded-sm border-gray-300 mt-6">
                <div class="card-body flex flex-col gap-4">
                    <h3 class="text-base font-semibold">{props.title}</h3>
                    {props.items.map((r) => (
                        <Replication
                            kind={r.type}
                            outcome={normalizeOutcome(r.outcome)}
                            authors={r.authors || undefined}
                            title={r.title || ''}
                            appaRef={r.apa_ref || ''}
                            bibtexRef={r.bibtex_ref || ''}
                            doi={r.doi}
                            journal={r.journal}
                            year={r.year}
                            volume={r.volume}
                            issue={r.issue}
                            pages={r.pages}
                            outcomeQuote={r.outcome_quote || ''}
                            outcomeQuoteSource={r.outcome_quote_source || ''}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (props.emptyMessage) {
        return <div class="mt-6 text-sm text-neutral/70">{props.emptyMessage}</div>;
    }

    return null;
};
