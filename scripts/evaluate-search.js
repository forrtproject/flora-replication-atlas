/**
 * Fuzzy Search API Evaluation Script
 *
 * Evaluates the /search endpoint across multiple dimensions:
 *   - Relevance (precision, recall, ranking via MRR)
 *   - Edge cases (typos, partial input, short queries, unicode)
 *   - Performance (latency p50/p95)
 *
 * Usage:
 *   node scripts/evaluate-search.js
 *   node scripts/evaluate-search.js --verbose
 */

const BASE_URL = process.env.SEARCH_URL || "https://rep-api.forrt.org/v1/search";
const LIMIT = 10;
const verbose = process.argv.includes("--verbose");

// ─── Test cases ──────────────────────────────────────────────────────
// Each test: { query, expectedDoi, description, category }

const testCases = [
  // ── Exact / known titles ──
  {
    query: "name letter effect",
    expectedDoi: "10.1002/ejsp.2420170402",
    description: "Nuttin 1987 – name letter effect",
    category: "title",
  },
  {
    query: "Power Posing",
    expectedDoi: "10.1177/0956797610383437",
    description: "Carney et al. – power posing",
    category: "title",
  },
  {
    query: "ego depletion glucose",
    expectedDoi: "10.1016/j.appet.2013.12.020",
    description: "Lange & Eggert – ego depletion glucose",
    category: "title",
  },
  {
    query: "stereotype threat distance interracial",
    expectedDoi: "10.1037/0022-3514.94.1.91",
    description: "Stereotype threat and distance",
    category: "title",
  },
  {
    query: "physical warmth loneliness",
    expectedDoi: "10.1037/arc0000007",
    description: "Warmth and loneliness replication",
    category: "title",
  },

  // ── Author-based queries ──
  {
    query: "Nuttin",
    expectedDoi: "10.1002/ejsp.2420170402",
    description: "Author search: Nuttin",
    category: "author",
  },
  {
    query: "Lange Eggert",
    expectedDoi: "10.1016/j.appet.2013.12.020",
    description: "Author search: Lange & Eggert",
    category: "author",
  },

  // ── Author + year combinations ──
  {
    query: "Nuttin 1987",
    expectedDoi: "10.1002/ejsp.2420170402",
    description: "Author + year: Nuttin 1987",
    category: "author+year",
  },
  {
    query: "Lange 2014",
    expectedDoi: "10.1016/j.appet.2013.12.020",
    description: "Author + year: Lange 2014",
    category: "author+year",
  },

  // ── Partial / short queries ──
  {
    query: "ego",
    expectedDoi: "10.1016/j.appet.2013.12.020",
    description: "Short query: ego",
    category: "short",
  },
  {
    query: "power",
    expectedDoi: "10.1177/0956797610383437",
    description: "Short query: power",
    category: "short",
  },
  {
    query: "name letter",
    expectedDoi: "10.1002/ejsp.2420170402",
    description: "Partial title: name letter",
    category: "partial",
  },

  // ── Typo / misspelling queries ──
  {
    query: "powr posing",
    expectedDoi: "10.1177/0956797610383437",
    description: "Typo: powr posing",
    category: "typo",
  },
  {
    query: "ego depltion",
    expectedDoi: "10.1016/j.appet.2013.12.020",
    description: "Typo: ego depltion",
    category: "typo",
  },
  {
    query: "steretotype threat",
    expectedDoi: "10.1037/0022-3514.94.1.91",
    description: "Typo: steretotype threat",
    category: "typo",
  },

  // ── Multi-word title fragments ──
  {
    query: "replication extension",
    expectedDoi: "10.1080/15332969.2014.916148",
    description: "Multi-word fragment: replication extension",
    category: "title-fragment",
  },
  {
    query: "reproducibility psychological science",
    expectedDoi: "10.1126/science.aac4716",
    description: "Multi-word fragment: reproducibility psych science",
    category: "title-fragment",
  },
  {
    query: "warmth interpersonal",
    expectedDoi: "10.1126/science.1162548",
    description: "Multi-word fragment: warmth interpersonal",
    category: "title-fragment",
  },
  {
    query: "effort gains track field relays",
    expectedDoi: "10.1016/j.psychsport.2019.101567",
    description: "Multi-word fragment: effort gains track field",
    category: "title-fragment",
  },

  // ── Multi-author queries ──
  {
    query: "Bargh Williams",
    expectedDoi: "10.1126/science.1162548",
    description: "Multi-author: Bargh & Williams",
    category: "multi-author",
  },
  {
    query: "Carney Cuddy Yap",
    expectedDoi: "10.1177/0956797610383437",
    description: "Multi-author: Carney, Cuddy & Yap",
    category: "multi-author",
  },
  {
    query: "McCann Bahl",
    expectedDoi: "10.1002/smj.2585",
    description: "Multi-author: McCann & Bahl",
    category: "multi-author",
  },

  // ── Author + year (extended) ──
  {
    query: "McCann Bahl 2016",
    expectedDoi: "10.1002/smj.2585",
    description: "Author + year: McCann Bahl 2016",
    category: "author+year",
  },

  // ── Journal name queries ──
  {
    query: "Psychological Science",
    expectedDoi: null, // just check it returns results without crashing
    description: "Journal search: Psychological Science",
    category: "journal",
  },

  // ── DOI fragment queries ──
  {
    query: "10.1037",
    expectedDoi: null, // DOI prefix — may or may not work
    description: "DOI fragment: 10.1037",
    category: "doi-fragment",
  },

  // ── Unicode / diacritics ──
  {
    query: "Hüffmeier",
    expectedDoi: "10.1016/j.psychsport.2019.101567",
    description: "Unicode: Hüffmeier (umlaut)",
    category: "unicode",
  },
  {
    query: "Huffmeier",
    expectedDoi: "10.1016/j.psychsport.2019.101567",
    description: "ASCII fallback: Huffmeier (no umlaut)",
    category: "unicode",
  },
  {
    query: "Röseler",
    expectedDoi: null,
    description: "Unicode: Röseler (diacritics)",
    category: "unicode",
  },

  // ── Case sensitivity ──
  {
    query: "power posing",
    expectedDoi: "10.1177/0956797610383437",
    description: "Lowercase: power posing",
    category: "case",
  },
  {
    query: "POWER POSING",
    expectedDoi: "10.1177/0956797610383437",
    description: "Uppercase: POWER POSING",
    category: "case",
  },

  // ── Garbage / empty-ish input ──
  {
    query: "xyzzy12345",
    expectedDoi: null,
    description: "Garbage input",
    category: "edge",
  },
  {
    query: "a",
    expectedDoi: null,
    description: "Single character",
    category: "edge",
  },
  {
    query: "ab",
    expectedDoi: null,
    description: "Two characters",
    category: "edge",
  },
  {
    query: "   ",
    expectedDoi: null,
    description: "Whitespace only",
    category: "edge",
  },
  {
    query: "the and of in",
    expectedDoi: null,
    description: "Stop words only",
    category: "edge",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

async function runQuery(query) {
  const url = `${BASE_URL}?q=${encodeURIComponent(query)}&limit=${LIMIT}`;
  const start = performance.now();
  const res = await fetch(url);
  const latency = performance.now() - start;

  if (!res.ok) {
    return { error: res.status, latency, results: {}, total: 0 };
  }

  const data = await res.json();
  return {
    results: data.results || {},
    total: data.total || 0,
    latency,
  };
}

function findRank(results, expectedDoi) {
  if (!expectedDoi) return null;
  const dois = Object.keys(results);
  const idx = dois.indexOf(expectedDoi);
  return idx === -1 ? 0 : idx + 1;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           FReD Fuzzy Search API — Evaluation Report         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\nEndpoint: ${BASE_URL}`);
  console.log(`Limit:    ${LIMIT} results per query`);
  console.log(`Tests:    ${testCases.length}\n`);

  const results = [];
  const latencies = [];
  const categoryStats = {};

  for (const tc of testCases) {
    const res = await runQuery(tc.query);
    const rank = findRank(res.results, tc.expectedDoi);
    const hit = rank !== null ? rank > 0 : null;
    const rr = rank > 0 ? 1 / rank : 0; // reciprocal rank

    latencies.push(res.latency);

    const entry = { ...tc, rank, hit, rr, latency: res.latency, total: res.total, error: res.error };
    results.push(entry);

    // Per-category stats
    if (!categoryStats[tc.category]) {
      categoryStats[tc.category] = { total: 0, hits: 0, rrSum: 0, top1: 0, top3: 0 };
    }
    const cat = categoryStats[tc.category];
    if (tc.expectedDoi) {
      cat.total++;
      if (hit) {
        cat.hits++;
        cat.rrSum += rr;
        if (rank === 1) cat.top1++;
        if (rank <= 3) cat.top3++;
      }
    }

    // Per-test output
    const icon = tc.expectedDoi === null
      ? "·"
      : hit ? "✓" : "✗";
    const rankStr = rank === null ? "n/a" : rank === 0 ? "MISS" : `#${rank}`;
    const latStr = `${Math.round(res.latency)}ms`;

    if (verbose || !hit) {
      console.log(`  ${icon}  [${rankStr.padStart(5)}] ${latStr.padStart(6)}  "${tc.query}" — ${tc.description}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────

  const ranked = results.filter((r) => r.expectedDoi !== null);
  const totalWithExpected = ranked.length;
  const totalHits = ranked.filter((r) => r.hit).length;
  const totalTop1 = ranked.filter((r) => r.rank === 1).length;
  const totalTop3 = ranked.filter((r) => r.rank > 0 && r.rank <= 3).length;
  const mrr = totalWithExpected > 0
    ? ranked.reduce((sum, r) => sum + r.rr, 0) / totalWithExpected
    : 0;

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("  OVERALL METRICS");
  console.log("────────────────────────────────────────────────────────────────");
  console.log(`  Hit Rate (in top ${LIMIT}):  ${totalHits}/${totalWithExpected}  (${pct(totalHits, totalWithExpected)})`);
  console.log(`  Top-1 Accuracy:        ${totalTop1}/${totalWithExpected}  (${pct(totalTop1, totalWithExpected)})`);
  console.log(`  Top-3 Accuracy:        ${totalTop3}/${totalWithExpected}  (${pct(totalTop3, totalWithExpected)})`);
  console.log(`  MRR (Mean Recip Rank): ${mrr.toFixed(3)}`);

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("  PER-CATEGORY BREAKDOWN");
  console.log("────────────────────────────────────────────────────────────────");
  for (const [cat, s] of Object.entries(categoryStats)) {
    if (s.total === 0) continue;
    const catMrr = s.rrSum / s.total;
    console.log(`  ${cat.padEnd(14)} Hit: ${s.hits}/${s.total} (${pct(s.hits, s.total)})  Top-1: ${pct(s.top1, s.total)}  MRR: ${catMrr.toFixed(3)}`);
  }

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("  LATENCY");
  console.log("────────────────────────────────────────────────────────────────");
  console.log(`  p50:  ${Math.round(percentile(latencies, 50))}ms`);
  console.log(`  p90:  ${Math.round(percentile(latencies, 90))}ms`);
  console.log(`  p95:  ${Math.round(percentile(latencies, 95))}ms`);
  console.log(`  max:  ${Math.round(Math.max(...latencies))}ms`);

  // ── Edge case report ──
  const edgeCases = results.filter((r) => r.expectedDoi === null);
  if (edgeCases.length > 0) {
    console.log("\n────────────────────────────────────────────────────────────────");
    console.log("  EDGE CASES");
    console.log("────────────────────────────────────────────────────────────────");
    for (const e of edgeCases) {
      const status = e.error ? `ERROR ${e.error}` : `OK (${e.total} results)`;
      console.log(`  "${e.query}" → ${status}  ${Math.round(e.latency)}ms`);
    }
  }

  console.log("\n════════════════════════════════════════════════════════════════\n");

  // Exit code: fail if MRR < 0.5
  if (mrr < 0.5) {
    console.log("⚠  MRR below 0.5 threshold — search quality needs improvement.\n");
    process.exit(1);
  }
}

function pct(n, d) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "–";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
