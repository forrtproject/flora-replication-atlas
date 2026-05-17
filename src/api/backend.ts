import type { Author, DOIResults } from "../@types";
import { createHttp } from "../utils/http";
import { replicationResponseHasNoData } from "./formatter";

const backend = createHttp({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://rep-api.forrt.org/v1",
});

const browseBackend = createHttp({
  baseURL:
    import.meta.env.VITE_BROWSE_BACKEND_URL ||
    "https://5waa6mryb6.execute-api.eu-central-1.amazonaws.com/v1",
  timeout: 30000,
});

export type FilterOptions = {
  authors: string[];
  journals: string[];
  outcomes: string[];
};

export type BrowseRecord = {
  _id: string;
  _type: "original" | "replication";
  doi: string;
  title: string;
  authors?: Author[];
  journal?: string;
  year?: string | number;
  volume?: string;
  issue?: string;
  pages?: string;
  apa_ref?: string;
  bibtex_ref?: string;
  replication_keys?: string[];
  reproduction_keys?: string[];
  original_keys?: string[];
  outcomes?: Record<string, string>;
  outcome_quotes?: Record<string, string>;
};

export type BrowseRecordsResponse = {
  limit: number;
  count: number;
  next_cursor?: string;
  results: BrowseRecord[];
};

export type BrowseFilters = {
  author?: string;
  journal?: string;
  outcome?: string;
  type?: "original" | "replication";
  cursor?: string;
  limit?: number;
};

export const fetchFilterOptions = async (): Promise<FilterOptions> => {
  const response = await browseBackend.get<FilterOptions>("/filter-options");
  return response.data;
};

export const fetchRecords = async (
  filters: BrowseFilters = {},
): Promise<BrowseRecordsResponse> => {
  const params: Record<string, string | number> = {};
  if (filters.author) params.author = filters.author;
  if (filters.journal) params.journal = filters.journal;
  if (filters.outcome) params.outcome = filters.outcome;
  if (filters.type) params.type = filters.type;
  if (filters.cursor) params.cursor = filters.cursor;
  params.limit = filters.limit ?? 20;

  const response = await browseBackend.post<BrowseRecordsResponse>(
    "/records",
    {},
    { params },
  );
  return response.data;
};

export const fetchDOIInfo = async (doi: string) => {
  const response = await backend.post<DOIResults>('/original-lookup', { dois: [doi] });

  return response.data;
};

const BATCH_SIZE = 100;

export const fetchMultipleDOIInfo = async (dois: string[]): Promise<DOIResults> => {
  if (dois.length <= BATCH_SIZE) {
    const response = await backend.post<DOIResults>('/original-lookup', { dois });
    response.data.isEmpty = replicationResponseHasNoData(response.data);
    return response.data;
  }

  const batches: string[][] = [];
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    batches.push(dois.slice(i, i + BATCH_SIZE));
  }

  const responses = await Promise.all(
    batches.map((batch) => backend.post<DOIResults>('/original-lookup', { dois: batch }))
  );

  const merged: DOIResults = { results: {}, isEmpty: true };
  for (const res of responses) {
    Object.assign(merged.results, res.data.results ?? {});
  }
  merged.isEmpty = replicationResponseHasNoData(merged);
  return merged;
};

export const fetchFuzzySearch = async (query: string, limit = 20): Promise<DOIResults> => {
  const response = await backend.get(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  const results = response.data.results ?? {};
  return { results, isEmpty: Object.keys(results).length === 0 };
};