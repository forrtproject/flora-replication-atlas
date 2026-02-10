import type { Author } from "../@types";

export const formatAuthors = (authors?: Author[]) => {
    if (!authors?.length) return "";
    const names = authors.map(author => {
        const given = author.given ? `, ${author.given}` : "";
        return `${author.family}${given}`;
    });
    if (names.length <= 3) return names.join("; ");
    return `${names.slice(0, 3).join("; ")}; et al.`;
};
