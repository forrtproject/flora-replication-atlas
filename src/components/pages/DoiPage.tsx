import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import type { DOIResults, OriginalPaper } from "../../@types";
import { fetchMultipleDOIInfo } from "../../api/backend";
import { TopBar } from "../layout/TopBar";
import { DetailView } from "../layout/DetailView";
import { NoDataState } from "../layout/NoDataState";
import { Footer } from "../Footer";

export const DoiPage = () => {
  const params = useParams<{ doi: string }>();
  const navigate = useNavigate();

  const doi = () => params.doi;
  const [paper, setPaper] = createSignal<OriginalPaper | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasData, setHasData] = createSignal(false);

  // SEO: update document title and meta tags
  const updateMeta = (paper: OriginalPaper | null) => {
    if (paper?.title) {
      document.title = `${paper.title} — FLoRA Replication Hub`;

      const setMetaTag = (name: string, content: string, attr = "name") => {
        let el = document.querySelector(
          `meta[${attr}="${name}"]`,
        ) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, name);
          document.head.appendChild(el);
        }
        el.content = content;
      };

      const authors =
        paper.authors?.map((a) => `${a.family}, ${a.given}`).join("; ") || "";
      const description = `Replication data for "${paper.title}" by ${authors} (${paper.year}). ${paper.journal || ""}`;

      setMetaTag("description", description);
      setMetaTag("og:title", paper.title, "property");
      setMetaTag("og:description", description, "property");
      setMetaTag("og:type", "article", "property");
      setMetaTag("og:url", window.location.href, "property");

      // Schema.org structured data for Google
      let script = document.getElementById(
        "doi-jsonld",
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "doi-jsonld";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ScholarlyArticle",
        name: paper.title,
        author: paper.authors?.map((a) => ({
          "@type": "Person",
          givenName: a.given,
          familyName: a.family,
        })),
        datePublished: String(paper.year),
        isPartOf: paper.journal
          ? { "@type": "Periodical", name: paper.journal }
          : undefined,
        identifier: {
          "@type": "PropertyValue",
          propertyID: "DOI",
          value: paper.doi,
        },
        url: `https://doi.org/${paper.doi}`,
      });
    } else {
      document.title = `${doi()} — FLoRA Replication Hub`;
    }
  };

  onCleanup(() => {
    document.title = "FLoRA Replication Summary";
    const jsonld = document.getElementById("doi-jsonld");
    if (jsonld) jsonld.remove();
  });

  onMount(() => {
    const doiValue = doi();
    if (!doiValue) return;

    fetchMultipleDOIInfo([doiValue])
      .then((res: DOIResults) => {
        const result = res.results?.[doiValue] || null;
        setPaper(result);
        setHasData(!!result?.record);
        updateMeta(result);
        setIsLoading(false);
      })
      .catch(() => {
        setPaper(null);
        setHasData(false);
        setIsLoading(false);
      });
  });

  const handleSearch = (tags: string[]) => {
    if (tags.length === 1) {
      navigate(`/doi/${tags[0]}`);
    } else if (tags.length > 1) {
      navigate(`/?dois=${tags.join(",")}`);
    }
  };

  return (
    <>
      <TopBar
        tags={[doi()]}
        inputValue=""
        onInputChange={() => {}}
        onAddTag={() => {}}
        onRemoveTag={() => navigate("/")}
        onSearchSubmit={() => {}}
        onNavigateSearch={handleSearch}
      />

      <div class="doi-page-layout">
        <Show
          when={!isLoading()}
          fallback={
            <div class="welcome-state">
              <div class="welcome-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#853953"
                  stroke-width="1.5"
                  class="spin"
                >
                  <path d="M12 2a10 10 0 1 0 10 10" />
                </svg>
              </div>
              <h2>Loading replication data...</h2>
              <p>{doi()}</p>
            </div>
          }
        >
          <Show
            when={hasData() && paper()}
            fallback={<NoDataState doi={doi()} />}
          >
            <DetailView paper={paper()!} />
          </Show>
        </Show>
      </div>

      <Footer />
    </>
  );
};
