import { writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "../dist");
const API_BASE = "https://rep-api.forrt.org/v1";
const SITE_URL = "https://forrt.org/flora-replication-atlas";
const BATCH_SIZE = 100;
const CONCURRENT_BATCHES = 5;

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchAllDois() {
  const res = await fetch(`${API_BASE}/dois`);
  if (!res.ok) throw new Error(`/dois returned ${res.status}`);
  const data = await res.json();
  const dois = Array.isArray(data) ? data : data.dois;
  if (!Array.isArray(dois)) throw new Error("Unexpected /dois response format");
  return dois;
}

async function fetchBatch(dois) {
  const res = await fetch(`${API_BASE}/original-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dois }),
  });
  if (!res.ok) throw new Error(`/original-lookup returned ${res.status}`);
  const data = await res.json();
  return data.results || {};
}

async function fetchAllPapers(dois) {
  const batches = [];
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    batches.push(dois.slice(i, i + BATCH_SIZE));
  }

  const results = {};
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const chunk = batches.slice(i, i + CONCURRENT_BATCHES);
    const chunkResults = await Promise.all(chunk.map(fetchBatch));
    for (const r of chunkResults) Object.assign(results, r);
    const fetched = Math.min((i + CONCURRENT_BATCHES) * BATCH_SIZE, dois.length);
    console.log(`  Fetched ${fetched}/${dois.length} papers...`);
  }
  return results;
}

function formatAuthors(authors) {
  if (!authors?.length) return "unknown authors";
  if (authors.length === 1) return authors[0].family;
  if (authors.length === 2) return `${authors[0].family} & ${authors[1].family}`;
  return `${authors[0].family} et al.`;
}

function buildPageMeta(paper) {
  const doi = paper.doi;
  const title = paper.title || doi;
  const authors = paper.authors || [];
  const authorNames = authors.map((a) => `${a.family}, ${a.given}`).join("; ");
  const authorLastNames = authors.map((a) => a.family).filter(Boolean);

  const replications = paper.record?.replications || [];
  const reproductions = paper.record?.reproductions || [];
  const stats = paper.record?.stats;
  const nReplications = stats?.n_replications_total ?? 0;
  const nReproductions = stats?.n_reproductions_total ?? 0;

  const allOutcomes = [
    ...replications.map((r) => r.outcome),
    ...reproductions.map((r) => r.outcome),
  ].filter(Boolean);
  const uniqueOutcomes = [...new Set(allOutcomes)];

  const replicationSentences = replications.map((r) => {
    const by = formatAuthors(r.authors);
    const outcome = r.outcome ? `described as ${r.outcome}` : "outcome not recorded";
    return `"${title}" has been replicated by ${by} (${r.year}), ${outcome}.`;
  });

  const reproductionSentences = reproductions.map((r) => {
    const by = formatAuthors(r.authors);
    const outcome = r.outcome ? `described as ${r.outcome}` : "outcome not recorded";
    return `"${title}" has been reproduced by ${by} (${r.year}), ${outcome}.`;
  });

  const replicationSummary =
    replicationSentences.length > 0 || reproductionSentences.length > 0
      ? [...replicationSentences, ...reproductionSentences].join(" ")
      : "No replications or reproductions recorded yet.";

  const description =
    `"${title}" by ${authorNames} (${paper.year}${paper.journal ? `, ${paper.journal}` : ""}). ` +
    `${replicationSummary} Indexed in the FLoRA Replication Atlas (FORRT FReD database). DOI: ${doi}`;

  const titleKeywords = title
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 6)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  const keywords = [
    ...authorLastNames,
    paper.journal,
    String(paper.year),
    ...uniqueOutcomes.map((o) => `${o} replication`),
    ...titleKeywords,
    "replication",
    "reproducibility",
    "open science",
    "FLoRA",
    "FReD",
    "FORRT",
    "replication crisis",
    "has this study been replicated",
  ]
    .filter(Boolean)
    .join(", ");

  const pageUrl = `${SITE_URL}/doi/${doi}`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    name: title,
    author: authors.map((a) => ({
      "@type": "Person",
      givenName: a.given,
      familyName: a.family,
    })),
    datePublished: String(paper.year),
    isPartOf: paper.journal
      ? { "@type": "Periodical", name: paper.journal }
      : undefined,
    identifier: { "@type": "PropertyValue", propertyID: "DOI", value: doi },
    url: `https://doi.org/${doi}`,
    description,
    keywords,
    subjectOf:
      nReplications > 0 || nReproductions > 0
        ? [
            ...replications.map((r) => ({
              "@type": "ScholarlyArticle",
              name: r.title,
              additionalType: "ReplicationStudy",
              ...(r.outcome && { description: `Outcome: ${r.outcome}` }),
              ...(r.doi && {
                identifier: { "@type": "PropertyValue", propertyID: "DOI", value: r.doi },
              }),
            })),
            ...reproductions.map((r) => ({
              "@type": "ScholarlyArticle",
              name: r.title,
              additionalType: "ReproductionStudy",
              ...(r.outcome && { description: `Outcome: ${r.outcome}` }),
              ...(r.doi && {
                identifier: { "@type": "PropertyValue", propertyID: "DOI", value: r.doi },
              }),
            })),
          ]
        : undefined,
  });

  return { title: `${title} — FLoRA Replication Atlas`, description, keywords, pageUrl, jsonLd, authors };
}

function injectMeta(html, meta) {
  const { title, description, keywords, pageUrl, jsonLd, authors } = meta;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(title)}</title>`);

  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${escHtml(pageUrl)}" />`,
  );

  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escHtml(description)}$2`,
  );
  html = html.replace(
    /(<meta name="keywords" content=")[^"]*(")/,
    `$1${escHtml(keywords)}$2`,
  );

  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${escHtml(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${escHtml(description)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,         `$1${escHtml(pageUrl)}$2`);
  html = html.replace(/(<meta property="og:type" content=")[^"]*(")/,        `$1article$2`);

  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${escHtml(title)}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${escHtml(description)}$2`);

  // Replace the site-level JSON-LD with the per-article one
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n    ${jsonLd}\n    </script>`,
  );

  // Inject per-author OG tags before </head>
  if (authors.length > 0) {
    const authorTags = authors
      .map((a) => `  <meta property="article:author" content="${escHtml(`${a.given} ${a.family}`)}">`)
      .join("\n");
    html = html.replace("</head>", `${authorTags}\n</head>`);
  }

  return html;
}

async function main() {
  const baseHtml = await readFile(join(DIST_DIR, "index.html"), "utf-8");

  console.log("Fetching DOI list...");
  const dois = await fetchAllDois();
  console.log(`Found ${dois.length} DOIs. Fetching paper data in batches of ${BATCH_SIZE}...`);

  const papers = await fetchAllPapers(dois);
  const fetched = Object.keys(papers).length;
  console.log(`Got data for ${fetched}/${dois.length} DOIs. Writing pages...`);

  let withMeta = 0;
  let withoutMeta = 0;

  for (const doi of dois) {
    const paper = papers[doi];
    const html = paper
      ? (withMeta++, injectMeta(baseHtml, buildPageMeta(paper)))
      : (withoutMeta++, baseHtml);

    const outPath = join(DIST_DIR, "doi", doi, "index.html");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf-8");

    const written = withMeta + withoutMeta;
    if (written % 100 === 0) console.log(`  ${written}/${dois.length} pages written`);
  }

  console.log(`Done. ${withMeta} pages with injected meta tags, ${withoutMeta} with fallback HTML.`);
}

main().catch((err) => {
  console.error("Pre-render failed:", err.message);
  process.exit(1);
});
