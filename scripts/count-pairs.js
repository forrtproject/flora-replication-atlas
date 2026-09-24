import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../public/counts.json");

// The same dataset, from the same URL, that the FLoRA Explorer counts for its
// headline figure — so the two sites never disagree about the size of FLoRA.
const FLORA_CSV_URL =
  "https://raw.githubusercontent.com/forrtproject/FReD-data/refs/heads/main/output/flora.csv";

/* One row is one pairing: an original (doi_o…) beside the study that replicated
   or reproduced it (doi_r…). Quoted fields hold abstracts with line breaks, so
   records have to be counted on unquoted newlines — flora.csv currently runs to
   ~15,800 physical lines for ~3,000 records. */
function countCsvRecords(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let records = 0;
  let inQuotes = false;
  let sawContent = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawContent = true;
      continue;
    }
    if (ch === "\n") {
      if (sawContent) records++;
      sawContent = false;
      continue;
    }
    if (ch !== "\r") sawContent = true;
  }
  if (sawContent) records++;
  return records - 1; // the header row
}

async function main() {
  console.log(`Fetching ${FLORA_CSV_URL} ...`);
  const res = await fetch(FLORA_CSV_URL);
  if (!res.ok) throw new Error(`flora.csv returned ${res.status}`);
  const csv = await res.text();

  const pairs = countCsvRecords(csv);
  if (pairs <= 0) throw new Error("Counted 0 pairings — refusing to overwrite");

  await writeFile(OUTPUT_PATH, `${JSON.stringify({ pairs }, null, 2)}\n`);
  console.log(
    `Wrote public/counts.json (${pairs.toLocaleString("en-US")} pairings).`,
  );
}

main().catch((err) => {
  // A blip here must not fail the deploy: the committed count is the last good
  // figure, so the build falls back to it rather than to nothing.
  console.warn(
    `Pair count not refreshed (${err.message}); keeping committed counts.json.`,
  );
});
