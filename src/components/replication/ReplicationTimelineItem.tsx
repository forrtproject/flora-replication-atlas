import type { Author, ReplicationStats } from "../../@types";
import { badgeBgs } from "../../configs";

type ReplicationTimelineItemProps = {
    doi?: string;
    title?: string;
    authors?: Author[];
    journal?: string;
    year?: number;
    stats?: ReplicationStats;
    children?: any;
    status?: "failed" | "successful" | "partial" | "mixed" | "uninformative" | "blank";
    defaultOpen?: boolean;
};

const formatAuthors = (authors?: Author[]) => {
    if (!authors?.length) return "";
    const names = authors.map(author => {
        const given = author.given ? `, ${author.given}` : "";
        return `${author.family}${given}`;
    });
    if (names.length <= 3) return names.join("; ");
    return `${names.slice(0, 3).join("; ")}; et al.`;
};

export const ReplicationTimelineItem = (props: ReplicationTimelineItemProps) => {
    const defaultProps = { checked: props.defaultOpen };
    const replicationCount = props.stats?.n_replications_total ?? 0;
    return (
        <div class="collapse collapse-arrow bg-base-100 border border-base-200">
            <input type="radio" {...defaultProps} name="fort-accordion" />
            <div class="collapse-title px-4 py-3">
                <div class="flex flex-col gap-2">
                    <div class="flex items-start gap-3">
                        <div class={`mt-2 h-2 w-2 min-w-2 rounded-full ${badgeBgs[props.status || "blank"]}`}></div>
                        <div class="flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                {props.title ? (
                                    <a class="link link-hover font-semibold" href={props.doi ? `https://doi.org/${props.doi}` : undefined} target="_blank" rel="noreferrer">
                                        {props.title}
                                    </a>
                                ) : (
                                    <span class="font-semibold">{props.doi}</span>
                                )}
                            </div>
                            <div class="text-xs text-neutral/70 mt-1">
                                {formatAuthors(props.authors)}
                            </div>
                            <div class="text-xs text-neutral/70 flex flex-wrap gap-2 mt-1">
                                {props.journal ? <span>{props.journal}</span> : null}
                                {props.year ? <span>{props.year}</span> : null}
                                {props.doi ? <span>{props.doi}</span> : null}
                            </div>
                            <span class="text-xs">Replications: {replicationCount}</span>
                        </div>
                        <div class="text-xs text-neutral/70">
                            <span class="collapse-open">Collapse</span>
                            <span class="collapse-closed">Expand</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="collapse-content text-sm">
                {props.children}
            </div>
        </div>
    );
};
