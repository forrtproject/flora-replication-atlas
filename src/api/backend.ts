import type { DOIResults } from "../@types";
import { createHttp } from "../utils/http";
import { replicationResponseHasNoData } from "./formatter";

const backend = createHttp({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://rep-api.forrt.org/v1",
});

const FUZZY_SEARCH_URL = "https://5waa6mryb6.execute-api.eu-central-1.amazonaws.com/v1/search"; // To be changed when the fuzzy search endpoint is deployed to the main backend

export const fetchDOIInfo = async (doi: string) => {
  const response = await backend.post<DOIResults>('/original-lookup', { dois: [doi] });

  return response.data;
};

export const fetchMultipleDOIInfo = async (dois: string[]) => {
  const response = await backend.post<DOIResults>('/original-lookup', { dois });
  response.data.isEmpty = replicationResponseHasNoData(response.data);
  return response.data;
};

export const fetchFuzzySearch = async (query: string, limit = 20): Promise<DOIResults> => {
  const url = `${FUZZY_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
  const data = await response.json();
  const results = data.results ?? {};
  return { results, isEmpty: Object.keys(results).length === 0 };
};