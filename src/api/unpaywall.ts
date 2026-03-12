import { createHttp } from "../utils/http";

const unpaywall = createHttp({
  baseURL: "https://api.unpaywall.org/v2",
});

const UNPAYWALL_EMAIL = import.meta.env.VITE_UNPAYWALL_EMAIL || "fred@forrt.org";

type UnpaywallOaLocation = {
  url: string;
  url_for_pdf: string | null;
  url_for_landing_page: string;
  is_best: boolean;
};

type UnpaywallResponse = {
  doi: string;
  title: string;
  is_oa: boolean;
  best_oa_location: UnpaywallOaLocation | null;
  oa_locations: UnpaywallOaLocation[];
};

export type PdfLookupResult = {
  pdfUrl: string | null;
  landingPageUrl: string | null;
  isOa: boolean;
};

export const fetchPdfUrl = async (doi: string): Promise<PdfLookupResult> => {
  const response = await unpaywall.get<UnpaywallResponse>(`/${encodeURIComponent(doi)}`, {
    params: { email: UNPAYWALL_EMAIL },
  });

  const data = response.data;

  if (!data.is_oa || !data.best_oa_location) {
    return { pdfUrl: null, landingPageUrl: null, isOa: false };
  }

  return {
    pdfUrl: data.best_oa_location.url_for_pdf,
    landingPageUrl: data.best_oa_location.url_for_landing_page || data.best_oa_location.url,
    isOa: true,
  };
};
