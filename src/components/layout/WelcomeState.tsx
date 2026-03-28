type WelcomeStateProps = {
  onExampleClick: (doi: string) => void;
};

const exampleDois = [
  "10.1126/science.aac4716",
  "10.1037/a0021524",
  "10.1111/j.1467-9280.2008.02225.x",
];

export const WelcomeState = (props: WelcomeStateProps) => {
  return (
    <div class="welcome-state">
      <div class="welcome-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#853953"
          stroke-width="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>
      <h2>Has this study been replicated?</h2>
      <p>
        Enter a DOI in the search bar above to see replication outcomes, related
        studies, and more.
      </p>
      <div class="welcome-examples">
        <div class="welcome-examples-label">Example DOIs</div>
        {exampleDois.map((doi) => (
          <div class="welcome-doi" onClick={() => props.onExampleClick(doi)}>
            <span>{doi}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};
