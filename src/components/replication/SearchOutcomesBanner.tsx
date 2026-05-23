import { createMemo, For } from "solid-js";

type OutcomeCounts = {
    success: number;
    failed: number;
    mixed: number;
    partial: number;
    total: number;
    categorizedTotal: number;
};

type SearchOutcomesBannerProps = {
    outcomes: OutcomeCounts;
    paperCount: number;
};

type Segment = {
    key: keyof Omit<OutcomeCounts, "total" | "categorizedTotal">;
    label: string;
    color: string;
};

const SEGMENTS: Segment[] = [
    { key: "success", label: "Successful", color: "var(--success)"  },
    { key: "failed",  label: "Failed",     color: "var(--error)"    },
    { key: "mixed",   label: "Mixed",      color: "var(--warning)"  },
    { key: "partial", label: "Partial",    color: "var(--primary)"  },
];

export const SearchOutcomesBanner = (props: SearchOutcomesBannerProps) => {
    const segments = createMemo(() =>
        SEGMENTS.filter(s => props.outcomes[s.key] > 0));

    const pct = (key: keyof Omit<OutcomeCounts, "total" | "categorizedTotal">) =>
        props.outcomes.categorizedTotal > 0
            ? (props.outcomes[key] / props.outcomes.categorizedTotal) * 100
            : 0;

    return (
        <div style={{
            background: "var(--white)",
            border: "1px solid var(--border-light)",
            "border-radius": "var(--radius)",
            padding: "12px 16px 10px",
            "margin-bottom": "12px",
            "font-family": "var(--font-body)",
        }}>
            <p style={{
                "font-size": "11px",
                "font-weight": "600",
                color: "var(--text-muted)",
                "text-transform": "uppercase",
                "letter-spacing": "0.06em",
                "margin-bottom": "8px",
            }}>
                {props.outcomes.total} Replication{props.outcomes.total !== 1 ? "s" : ""} · {props.paperCount} Paper{props.paperCount !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", width: "100%", height: "28px", "border-radius": "var(--radius)", overflow: "hidden", gap: "2px" }}>
                <For each={segments()}>
                    {(s) => (
                        <div
                            style={{ background: s.color, width: `${pct(s.key)}%`, display: "flex", "align-items": "center", "justify-content": "center" }}
                            title={`${s.label}: ${props.outcomes[s.key]}`}
                        >
                            <span style={{ color: "white", "font-size": "11px", "font-weight": "700", "text-shadow": "0 1px 2px rgba(0,0,0,0.25)", "user-select": "none" }}>
                                {props.outcomes[s.key]}
                            </span>
                        </div>
                    )}
                </For>
            </div>
            <div style={{ display: "flex", width: "100%", gap: "2px", "margin-top": "4px" }}>
                <For each={segments()}>
                    {(s) => (
                        <div style={{ width: `${pct(s.key)}%`, "text-align": "center", overflow: "hidden" }}>
                            <span style={{ "font-size": "10px", "font-weight": "600", color: s.color, "white-space": "nowrap" }}>
                                {s.label}
                            </span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};
