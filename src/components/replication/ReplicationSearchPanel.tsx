import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { Search } from "../Search";
import { fetchMultipleDOIInfo } from "../../api/backend";
import { formatReplicationResponse } from "../../api/formatter";
import type { DOIResults } from "../../@types";
import { ReplicationSummary } from "./ReplicationSummary";
import { SearchOutcomesBanner } from "./SearchOutcomesBanner";
import { Skeleton } from "../Skeleton";
import { query } from "../../utils/http";
import { ResearchNotFound } from "./ResearchNotFount";

type ReplicationSearchPanelProps = {
    onSuccess?: (data: DOIResults) => void;
};

export const ReplicationSearchPanel = (props: ReplicationSearchPanelProps) => {
    const [searchTerm, setSearch] = createSignal(query.get('doi') || query.get('dois') || '');
    const [dois, setDois] = createSignal<DOIResults | null>(null);
    const [isLoading, setIsLoading] = createSignal(false);
    const [emptyResults, setEmptyResults] = createSignal(false);
    const resultEntries = () => Object.entries(dois()?.results || {});

    const aggregateOutcomes = createMemo(() => {
        const results = dois()?.results;
        if (!results) return { success: 0, failed: 0, mixed: 0, partial: 0, total: 0, categorizedTotal: 0 };
        const counts = Object.values(results).reduce(
            (acc, paper) => {
                const rep = formatReplicationResponse(paper);
                acc.success += rep.outcomes?.success ?? 0;
                acc.failed  += rep.outcomes?.failed  ?? 0;
                acc.mixed   += rep.outcomes?.mixed   ?? 0;
                acc.partial += rep.outcomes?.partial ?? 0;
                acc.total   += rep.outcomes?.total   ?? 0;
                return acc;
            },
            { success: 0, failed: 0, mixed: 0, partial: 0, total: 0 }
        );
        return {
            ...counts,
            categorizedTotal: counts.success + counts.failed + counts.mixed + counts.partial,
        };
    });

    const paperCount = createMemo(() =>
        Object.values(dois()?.results || {}).filter(p => p.record != null).length
    );

    createEffect(() => {
        const q = searchTerm();
        if (q.trim() === '') {
            setDois(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setDois(null);

        const params = q.split(',').map(doi => doi.trim()).filter(doi => doi !== '');

        const timeoutId = setTimeout(() => {
            setEmptyResults(false);
            fetchMultipleDOIInfo(params)
                .then(res => {
                    if (res.isEmpty) {
                        setEmptyResults(true);
                        setDois(null);
                    } else {
                        setDois(res);
                        props.onSuccess?.(res);
                    }
                    setIsLoading(false);
                })
                .catch(error => {
                    console.error('Error fetching DOI info:', error);
                    setIsLoading(false);
                    setEmptyResults(true);
                });
        }, 300);

        return () => clearTimeout(timeoutId);
    });

    return (
        <div class="p-4">
            <h2 class="text-lg font-bold mb-2">Search for Replications</h2>
            <Search value={searchTerm()} placeholder="Begin typing your doi (document object id)" onChange={q => setSearch(q)} />
            <Show when={isLoading()}>
                <section class="p-4 rounded-md flex justify-center">
                    <Skeleton />
                </section>
            </Show>
            <Show when={dois() !== null && !isLoading()}>
                <Show when={aggregateOutcomes().total > 0}>
                    <SearchOutcomesBanner outcomes={aggregateOutcomes()} paperCount={paperCount()} />
                </Show>
                {resultEntries().map(([key, res]) => (
                    <ReplicationSummary q={key} data={res} />
                ))}
            </Show>
            <Show when={emptyResults() && searchTerm().trim() !== '' && !isLoading()}>
                <ResearchNotFound doi={searchTerm().trim()} />
            </Show>
        </div>
    );
};