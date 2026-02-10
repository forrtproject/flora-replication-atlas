// TypeScript types generated from results.json

export type Author = {
  given: string;
  family: string;
  sequence: "first" | "additional";
  ORCID?: string;
};

export type ReplicationStats = {
  n_replications_total: number;
  n_replications_with_doi: number;
  n_replications_only: number;
  n_unique_replication_dois: number;
  n_reproductions_total: number;
  n_reproductions_with_doi: number;
  n_reproductions_only: number;
  n_originals_total: number;
  n_unique_original_dois: number;
};

export type ReplicationItem = {
  doi: string;
  doi_hash: string;
  type: "replication" | "reproduction" | "original";
  title: string;
  authors: Author[];
  journal: string;
  year: number;
  volume: string;
  issue: string | null;
  pages: string | null;
  apa_ref: string;
  bibtex_ref: string;
  url: string | null;
  outcome: "successful" | "failed" | "mixed" | "partial";
  outcome_quote?: string;
  outcome_quote_source?: string;
};

export type RecordData = {
  stats: ReplicationStats;
  replications: ReplicationItem[];
  originals: ReplicationItem[];
  reproductions: ReplicationItem[];
};

export type OriginalPaper = {
  doi: string;
  doi_hash: string;
  title: string;
  authors: Author[];
  journal: string;
  year: number;
  volume: string;
  issue: string | null;
  pages: string;
  apa_ref: string;
  bibtex_ref: string;
  url: string | null;
  record: RecordData;
};

export type DOIResults = {
  results: Record<string, OriginalPaper>;
  isEmpty: boolean;
};

export type FormattedDOIResult = {
  doi?: string;
  title?: string;
  authors?: Author[];
  journal?: string;
  year?: number;
  apaRef?: string;
  bibtexRef?: string;
  stats?: ReplicationStats;
  replications?: ReplicationItem[];
  originals?: ReplicationItem[];
  reproductions?: ReplicationItem[];
  outcomes?: {
    success?: number;
    failed?: number;
    mixed?: number;
    partial?: number;
    total?: number;
  };
  data?: OriginalPaper;
};

export type IconProps = {
  className?: string;
  color?: string;
};