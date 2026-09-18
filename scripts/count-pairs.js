import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../public/counts.json");
const API_BASE = "https://rep-api.forrt.org/v1";
const BATCH_SIZE = 100;
const CONCURRENT_BATCHES = 5;

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

/* Pairs, not papers: /dois lists an original and the paper replicating it as two
   separate entries, so counting that list counts each study twice over. Every
   recorded attempt is one pairing of an original with the paper that tried it. */
async function countPairs(dois) {
  const batches = [];
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    batches.push(dois.slice(i, i + BATCH_SIZE));
  }

  let pairs = 0;
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const chunk = batches.slice(i, i + CONCURRENT_BATCHES);
    const chunkResults = await Promise.all(chunk.map(fetchBatch));
    for (const results of chunkResults) {
      for (const paper of Object.values(results)) {
        const rec = paper?.record || {};
        pairs +=
          (rec.replications?.length || 0) + (rec.reproductions?.length || 0);
      }
    }
    const done = Math.min((i + CONCURRENT_BATCHES) * BATCH_SIZE, dois.length);
    console.log(`  Counted ${done}/${dois.length} papers...`);
  }
  return pairs;
}

async function main() {
  console.log(`Fetching DOIs from ${API_BASE}/dois ...`);
  const dois = (await fetchAllDois()).filter((d) => /^10\./.test(d));
  console.log(`Counting pairs across ${dois.length} DOIs...`);

  const pairs = await countPairs(dois);
  if (pairs === 0) throw new Error("Counted 0 pairs — refusing to overwrite");

  await writeFile(OUTPUT_PATH, `${JSON.stringify({ pairs }, null, 2)}\n`);
  console.log(`Wrote public/counts.json (${pairs.toLocaleString("en-US")} study pairs).`);
}

main().catch((err) => {
  // A blip here must not fail the deploy: the committed count is the last exact
  // figure, so the build falls back to it rather than to nothing.
  console.warn(`Pair count not refreshed (${err.message}); keeping committed counts.json.`);
});
