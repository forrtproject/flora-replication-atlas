import { createEffect, createSignal, Show  } from "solid-js";
import { Search } from "../Search";
import { fetchMultipleDOIInfo } from "../../api/backend";
import type { DOIResults } from "../../@types";
import { ReplicationSummary } from "./ReplicationSummary";
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
        
        // Debounce the API call by 1 second
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

        // Cleanup function to clear timeout if searchTerm changes before timeout completes
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
                {resultEntries().map(([key, res]) => (
                    <ReplicationSummary q={key} data={res} />
                ))}
            </Show>
            <Show when={emptyResults() && searchTerm().trim() !== '' && !isLoading()}>
                <ResearchNotFound />
            </Show>
        </div>
    );
}