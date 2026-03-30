import type { Author } from "../@types";

export const NA_MARKER = "__NOT_AVAILABLE__";

export const formatAuthors = (authors?: Author[]) => {
    if (!Array.isArray(authors) || authors.length === 0) return NA_MARKER;
    const names = authors
        .map(author => {
            const family = author.family || "";
            const given = author.given ? `, ${author.given}` : "";
            return family ? `${family}${given}` : author.given || "";
        })
        .filter(name => name.length > 0);
    if (!names.length) return NA_MARKER;
    if (names.length <= 3) return names.join("; ");
    return `${names.slice(0, 3).join("; ")}; et al.`;
};

export const na = (label: string) => <span class="not-available">{label} Not Available</span>;

export const renderAuthors = (authors?: Author[]) => {
    const result = formatAuthors(authors);
    return result === NA_MARKER ? na("Author Name") : result;
};
