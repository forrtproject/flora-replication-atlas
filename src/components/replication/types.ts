import type { Author } from "../../@types";

export type ReplicationProps = {
    title?: string | null;
    appaRef?: string | null;
    bibtexRef?: string | null;
    authors?: Author[] | null;
    outcome?: "failed" | "successful" | "partial" | "mixed" | "uninformative" | "blank";
    doi?: string | null;
    journal?: string | null;
    year?: number | null;
    volume?: string | null;
    issue?: string | null;
    pages?: string | null;
    outcomeQuote?: string | null;
    outcomeQuoteSource?: string | null;
    kind?: "replication" | "reproduction" | "original";
};