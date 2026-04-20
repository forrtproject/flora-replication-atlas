import type { DOIResults } from "../@types";
import { createHttp } from "../utils/http";
import { replicationResponseHasNoData } from "./formatter";

const backend = createHttp({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://rep-api.forrt.org/v1",
});

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