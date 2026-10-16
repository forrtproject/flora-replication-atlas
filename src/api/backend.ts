import type { DOIResults, OriginalPaper } from "../@types";
import { createHttp, HttpError } from "../utils/http";
import { normalizePaperAuthors } from "../utils/authors.js";
import { replicationResponseHasNoData } from "./formatter";

type SearchResponse = {
  results: Record<string, OriginalPaper>;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

// Temporarily pointed at dev: /sets (the DOI-list shortener behind ?set= links)
// is not on prod yet. Revert to https://rep-api.forrt.org/v1/ once it ships.
const backend = createHttp({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://rep-api.forrt.org/v1/",
});

// `authors` arrives as an Author[] on most records but as a string on others —
// an APA byline, an "A; B; C" list, or a JSON-encoded array — so every paper is
// coerced at the boundary rather than guarded at each of its call sites.
const normalizeResults = (data: DOIResults): DOIResults => {
  for (const paper of Object.values(data.results ?? {})) {
    normalizePaperAuthors(paper);
  }
  return data;
};

export const fetchDOIInfo = async (doi: string) => {
  const response = await backend.post<DOIResults>('/original-lookup', { dois: [doi] });

  return normalizeResults(response.data);
};

// /original-lookup silently truncates its response at 200 results, so batches
// stay below that with margin rather than sitting on the boundary.
const BATCH_SIZE = 150;

// Batch starts are staggered so a large set doesn't hit the API as one burst.
const BATCH_STAGGER_MS = 200;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchMultipleDOIInfo = async (dois: string[]): Promise<DOIResults> => {
  if (dois.length <= BATCH_SIZE) {
    const response = await backend.post<DOIResults>('/original-lookup', { dois });
    const data: DOIResults = normalizeResults(
      response.data ?? { results: {}, isEmpty: true },
    );
    data.isEmpty = replicationResponseHasNoData(data);
    return data;
  }

  const batches: string[][] = [];
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    batches.push(dois.slice(i, i + BATCH_SIZE));
  }

  const responses = await Promise.all(
    batches.map(async (batch, i) => {
      if (i > 0) await delay(i * BATCH_STAGGER_MS);
      return backend.post<DOIResults>('/original-lookup', { dois: batch });
    })
  );

  const merged: DOIResults = { results: {}, isEmpty: true };
  for (const res of responses) {
    Object.assign(merged.results, (res.data ?? {}).results ?? {});
  }
  normalizeResults(merged);
  merged.isEmpty = replicationResponseHasNoData(merged);
  return merged;
};

export type DoiSet = {
  id: string;
  dois: string[];
  count: number;
  created: string;
  expires: string;
};

export class SetExpiredError extends Error {
  constructor() {
    super("This DOI set has expired");
    this.name = "SetExpiredError";
  }
}

export class SetLinkIncompleteError extends Error {
  constructor() {
    super("This DOI set link is incomplete");
    this.name = "SetLinkIncompleteError";
  }
}

// A ?set= link is `?set=<row id>#k=<key>`. The extension encrypted the DOI list in the
// browser and put the key in the fragment, which browsers never send to a server, so the
// API holds only ciphertext and the list is decrypted here. Keep these parameters in step
// with the extension's set-crypto.ts.
const SET_ID = /^[0-9a-f]{8}$/;
const SET_KEY = /^[A-Za-z0-9_-]{43}$/;
const SET_AAD = new TextEncoder().encode("flora-doi-set:v2");

// The pre-fragment `<row id>.<key>` shape. Those sets are gone, so say so rather than
// calling a link that arrived whole "incomplete".
const RETIRED_SET_TOKEN = /^[0-9a-f]{8}\.[A-Za-z0-9_-]{43}$/;

type SealedSet = { id: string; data: string; iv: string; expires: string };

const fromBase64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const openSet = async (sealed: SealedSet, key: string) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", fromBase64url(key), "AES-GCM", false, ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64url(sealed.iv), additionalData: SET_AAD },
    cryptoKey,
    fromBase64url(sealed.data),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as { dois?: unknown; created?: unknown };
};

export const fetchSet = async (id: string, key: string): Promise<DoiSet> => {
  if (RETIRED_SET_TOKEN.test(id)) throw new SetExpiredError();
  // A link that arrives cut short — wrapped by a mail client, clipped by a linkifier, the
  // fragment dropped — would 404 like an expired one, and telling the reader to wait out an
  // expiry they cannot wait out is worse than telling them the link came through broken.
  if (!SET_ID.test(id) || !SET_KEY.test(key)) throw new SetLinkIncompleteError();

  let sealed: SealedSet;
  try {
    sealed = (await backend.get<SealedSet>(`/sets/${id}`)).data;
  } catch (error) {
    // Expiry is the documented end of a set's life, not a failure. The server's
    // message is human-facing copy, so branch on the code instead.
    const body = error instanceof HttpError ? error.response?.data : undefined;
    if ((body as { code?: string } | undefined)?.code === "set_expired") {
      throw new SetExpiredError();
    }
    throw error;
  }

  // GCM authenticates, so a key that is wrong or damaged fails here instead of
  // producing a list of garbage DOIs.
  let payload: Awaited<ReturnType<typeof openSet>>;
  try {
    payload = await openSet(sealed, key);
  } catch {
    throw new SetLinkIncompleteError();
  }

  const dois = Array.isArray(payload.dois)
    ? payload.dois.filter((d): d is string => typeof d === "string")
    : [];
  return {
    id,
    dois,
    count: dois.length,
    created: typeof payload.created === "string" ? payload.created : "",
    expires: sealed.expires,
  };
};

const MAX_PAGES = 50;

export const fetchFuzzySearch = async (query: string): Promise<DOIResults> => {
  const allResults: Record<string, OriginalPaper> = {};
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await backend.get<SearchResponse>(
      `/search?q=${encodeURIComponent(query)}&limit=1000&offset=${offset}`
    );
    const data = response.data;
    if (Object.keys(data.results ?? {}).length === 0) break;
    Object.assign(allResults, data.results ?? {});
    if (!data.hasMore) break;
    offset += 1000;
  }

  return normalizeResults({
    results: allResults,
    isEmpty: Object.keys(allResults).length === 0,
  });
};

export type AdvancedSearchParams = {
  mustHave?: string[];
  anyOf?: string[];
  exclude?: string[];
  yearFrom?: number;
  yearTo?: number;
  outcomes?: string[];
  paperTypes?: string[];
};

export const fetchAdvancedSearch = async (params: AdvancedSearchParams): Promise<DOIResults> => {
  const baseBody: Record<string, unknown> = {};
  if (params.mustHave?.length) baseBody.mustHave = params.mustHave;
  if (params.anyOf?.length) baseBody.anyOf = params.anyOf;
  if (params.exclude?.length) baseBody.exclude = params.exclude;
  if (params.yearFrom !== undefined) baseBody.yearFrom = params.yearFrom;
  if (params.yearTo !== undefined) baseBody.yearTo = params.yearTo;
  if (params.outcomes?.length) baseBody.outcomes = params.outcomes;
  if (params.paperTypes?.length) baseBody.paperTypes = params.paperTypes;

  const allResults: Record<string, OriginalPaper> = {};
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await backend.post<SearchResponse>('/search', { ...baseBody, limit: 1000, offset });
    const data = response.data;
    if (Object.keys(data.results ?? {}).length === 0) break;
    Object.assign(allResults, data.results ?? {});
    if (!data.hasMore) break;
    offset += 1000;
  }

  return normalizeResults({
    results: allResults,
    isEmpty: Object.keys(allResults).length === 0,
  });
};