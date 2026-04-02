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

export const fetchMultipleDOIInfo = async (dois: string[]) => {
  const response = await backend.post<DOIResults>('/original-lookup', { dois });
  response.data.isEmpty = replicationResponseHasNoData(response.data);
  return response.data;
};

export const fetchFuzzySearch = async (query: string, limit = 20): Promise<DOIResults> => {
  const response = await backend.get(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  const results = response.data.results ?? {};
  return { results, isEmpty: Object.keys(results).length === 0 };
};