type WelcomeStateProps = {
  onExampleClick: (query: string) => void;
};

const exampleSearches = [
  { label: "social priming", query: "social priming" },
  { label: "ego depletion replication", query: "ego depletion replication" },
  { label: "10.1126/science.aac4716", query: "10.1126/science.aac4716" },
  { label: "10.1037/a0021524", query: "10.1037/a0021524" },
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
        Search by title, author, or DOI to see replication outcomes, related
        studies, and more.
      </p>
      <div class="welcome-examples">
        <div class="welcome-examples-label">Example searches</div>
        {exampleSearches.map((ex) => (
          <div class="welcome-doi" onClick={() => props.onExampleClick(ex.query)}>
            <span>{ex.label}</span>
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
