import type { ParsedReference } from "./referenceParser";
import { extractDoisDirect } from "./referenceParser";

function extractOsfGuid(url: string): string | null {
  const m = url.match(/osf\.io\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

export async function fetchOsfDois(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ParsedReference[]> {
  const url = rawUrl.trim();
  const guid = extractOsfGuid(url);
  if (!guid) {
    throw new Error("Not a valid OSF URL. Expected format: https://osf.io/{id}");
  }

  let downloadUrl: string | null = null;

  // Try as a file first
  try {
    const res = await fetch(`https://api.osf.io/v2/files/${guid}/`, {
      headers: { Accept: "application/vnd.api+json" },
      signal: signal ?? AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: { links?: { download?: string } } };
      downloadUrl = json?.data?.links?.download ?? null;
    }
  } catch (e) {
    if (signal?.aborted) throw e;
  }

  // Fall back to node (project) — grab first PDF or first file
  if (!downloadUrl) {
    try {
      const res = await fetch(
        `https://api.osf.io/v2/nodes/${guid}/files/osfstorage/?page[size]=10`,
        {
          headers: { Accept: "application/vnd.api+json" },
          signal: signal ?? AbortSignal.timeout(10_000),
        },
      );
      if (res.ok) {
        const json = await res.json() as {
          data?: { attributes?: { name?: string }; links?: { download?: string } }[];
        };
        const files = json?.data ?? [];
        const pdf = files.find(f => f.attributes?.name?.toLowerCase().endsWith(".pdf"));
        const target = pdf ?? files[0];
        downloadUrl = target?.links?.download ?? null;
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }

  if (!downloadUrl) {
    throw new Error(
      "Could not find a downloadable file at this OSF link. " +
      "Make sure it points to a public file or project with files.",
    );
  }

  const fileRes = await fetch(downloadUrl, {
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!fileRes.ok) {
    throw new Error(
      `Failed to download OSF content (HTTP ${fileRes.status}). The file may be private or restricted.`,
    );
  }

  const contentType = fileRes.headers.get("content-type") ?? "";
  let text: string;
  if (contentType.includes("pdf") || /\.pdf/i.test(downloadUrl)) {
    const buf = await fileRes.arrayBuffer();
    text = new TextDecoder("latin-1").decode(buf);
  } else {
    text = await fileRes.text();
  }

  return extractDoisDirect(text);
}
