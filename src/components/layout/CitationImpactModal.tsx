import { createEffect, Show, For, onCleanup } from "solid-js";
import type { OriginalPaper } from "../../@types";

type Props = {
  paper: OriginalPaper;
  onClose: () => void;
};

const COLORS = {
  only:       "rgba(180,180,180,0.6)",
  failed:     "#b42318",
  mixed:      "#b8860b",
  successful: "#16a34a",
};

const CHIP_BG: Record<string, string> = {
  failed:     "rgba(180,35,24,0.10)",
  mixed:      "rgba(184,134,11,0.10)",
  successful: "rgba(22,163,74,0.10)",
};

const FONT = "'Source Sans 3','Segoe UI',sans-serif";

function niceMax(raw: number): number {
  if (raw <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 5, 10].map((m) => m * mag);
  for (const c of candidates) if (c >= raw) return c;
  return candidates[candidates.length - 1]!;
}

function niceTicks(max: number, count = 5): number[] {
  const step = niceMax(max / (count - 1));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

function StackedBarChart(props: {
  data: NonNullable<OriginalPaper["citation_timeline"]>;
  reps: NonNullable<OriginalPaper["record"]>["replications"];
}) {
  const ML = 52, MR = 72, MT = 38, MB = 50;
  const VW = 720, VH = 360;
  const CW = VW - ML - MR;
  const CH = VH - MT - MB;

  const totals     = () => props.data.map((d) => d.only + d.with_failed + d.with_mixed + d.with_successful);
  const rawMax     = () => Math.max(...totals(), 1);
  const yMax       = () => niceMax(rawMax() * 1.05);
  const ticks      = () => niceTicks(yMax());
  const n          = () => props.data.length;
  const slotW      = () => CW / Math.max(n(), 1);
  const barW       = () => Math.min(slotW() * 0.72, 32);
  const scaleY     = (v: number) => (v / yMax()) * CH;
  const barCentreX = (i: number) => ML + i * slotW() + slotW() / 2;
  const barX       = (i: number) => barCentreX(i) - barW() / 2;
  const minYear    = () => props.data[0]?.year ?? 0;
  const maxYear    = () => props.data[props.data.length - 1]?.year ?? 0;

  const yearToX = (year: number): number => {
    const exact = props.data.findIndex((d) => d.year === year);
    if (exact >= 0) return barCentreX(exact);
    const range = maxYear() - minYear();
    if (range <= 0 || n() <= 1) return ML + CW / 2;
    const yps = range / (n() - 1);
    return year > maxYear()
      ? barCentreX(n() - 1) + ((year - maxYear()) / yps) * slotW()
      : barCentreX(0)       - ((minYear() - year) / yps) * slotW();
  };

  const repLines = () =>
    props.reps.filter((r) => r.year != null).map((r) => ({ x: yearToX(r.year!), r }));

  const xLabels = () => {
    const every    = n() > 50 ? 10 : n() > 25 ? 5 : n() > 12 ? 2 : 1;
    const fromData = props.data.map((d, i) => ({ year: d.year, x: barCentreX(i) })).filter((_, i) => i % every === 0);
    const repYears = props.reps.map((r) => r.year).filter((y): y is number => y != null && (y < minYear() || y > maxYear()));
    return { fromData, extra: repYears.map((y) => ({ year: y, x: yearToX(y) })) };
  };

  const muted = { "font-family": FONT, fill: "var(--text-muted)" } as const;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}
      font-family={FONT} aria-label="Citation timeline">

      {/* Chart area background */}
      <rect x={ML} y={MT} width={CW} height={CH} fill="var(--surface)" rx="3" opacity="0.45" />

      {/* Grid lines */}
      <For each={ticks()}>
        {(t) => {
          const y = MT + CH - scaleY(t);
          return (
            <>
              <line x1={ML} x2={ML + CW} y1={y} y2={y}
                stroke="rgba(133,57,83,0.08)" stroke-width="1" />
              <text x={ML - 7} y={y + 4} text-anchor="end" font-size="11" {...muted}>{t}</text>
            </>
          );
        }}
      </For>

      {/* Bars */}
      <For each={props.data}>
        {(d, i) => {
          type LK = "only" | "with_failed" | "with_mixed" | "with_successful";
          const layers: { key: LK; val: number }[] = [
            { key: "only",            val: d.only },
            { key: "with_failed",     val: d.with_failed },
            { key: "with_mixed",      val: d.with_mixed },
            { key: "with_successful", val: d.with_successful },
          ];
          let cumY = 0;
          const rects: { y: number; h: number; fill: string }[] = [];
          for (const l of layers) {
            if (l.val <= 0) continue;
            const isBase = l.key === "only";
            const h    = isBase ? scaleY(l.val) : Math.max(scaleY(l.val), 3);
            const fill = isBase ? COLORS.only : l.key === "with_failed" ? COLORS.failed :
              l.key === "with_mixed" ? COLORS.mixed : COLORS.successful;
            rects.push({ y: MT + CH - scaleY(cumY) - h, h, fill });
            cumY += l.val;
          }
          const x = barX(i()), w = barW();
          return (
            <For each={rects}>
              {(r, ri) => (
                <rect x={x} y={r.y} width={w} height={Math.max(r.h, 0.5)} fill={r.fill}
                  rx={ri() === rects.length - 1 ? 2 : 0} ry={ri() === rects.length - 1 ? 2 : 0} />
              )}
            </For>
          );
        }}
      </For>

      {/* Rep lines */}
      <For each={repLines()}>
        {({ x, r }, i) => {
          const outcome  = r.outcome.split(",")[0]?.trim() ?? r.outcome;
          const label    = `${outcome} rep ${r.year}`;
          const color    = COLORS[outcome as keyof typeof COLORS] ?? "#853953";
          const chipBg   = CHIP_BG[outcome] ?? "rgba(133,57,83,0.10)";
          const FS       = 10;
          const approxW  = label.length * FS * 0.58 + 14;
          const labelY   = MT - 10 - (i() % 2) * 18;
          const anchor   = x > ML + CW - approxW / 2 ? "end" : x < ML + approxW / 2 ? "start" : "middle";
          const chipX    = anchor === "end" ? x - approxW : anchor === "start" ? x : x - approxW / 2;
          const textX    = anchor === "end" ? chipX + approxW - 6 : anchor === "start" ? chipX + 6 : chipX + approxW / 2;
          return (
            <>
              <line x1={x} x2={x} y1={MT} y2={MT + CH}
                stroke={color} stroke-width="1.5" stroke-dasharray="5 3" opacity="0.85" />
              <rect x={chipX} y={labelY - 12} width={approxW} height={16} rx="3" fill={chipBg} />
              <text x={textX} y={labelY} text-anchor={anchor}
                style={{ "font-size": `${FS}px`, fill: color, "font-family": FONT, "font-weight": "700" }}>{label}</text>
            </>
          );
        }}
      </For>

      {/* Axes */}
      <line x1={ML} x2={ML + CW} y1={MT + CH} y2={MT + CH} stroke="var(--border)" stroke-width="1" />
      <line x1={ML} x2={ML}      y1={MT}       y2={MT + CH} stroke="var(--border)" stroke-width="1" />

      {/* X labels */}
      <For each={xLabels().fromData}>
        {({ year, x }) => <text x={x} y={MT + CH + 18} text-anchor="middle" font-size="11" {...muted}>{year}</text>}
      </For>
      <For each={xLabels().extra}>
        {({ year, x }) => <text x={x} y={MT + CH + 18} text-anchor="middle" font-size="11" {...muted}>{year}</text>}
      </For>

      {/* Axis titles */}
      <text x={ML + CW / 2} y={VH - 4} text-anchor="middle" font-size="12" {...muted}>Year</text>
      <text transform={`translate(13,${MT + CH / 2}) rotate(-90)`}
        text-anchor="middle" font-size="11" {...muted}>Citing preprints / papers</text>
    </svg>
  );
}

const LEGEND = [
  { color: COLORS.successful, label: "Co-cites successful rep" },
  { color: COLORS.mixed,      label: "Co-cites mixed rep" },
  { color: COLORS.failed,     label: "Co-cites failed rep" },
  { color: COLORS.only,       label: "Cites original only" },
] as const;

export const CitationImpactModal = (props: Props) => {
  const handleBackdrop = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains("cim-backdrop")) props.onClose();
  };
  const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
  createEffect(() => {
    document.addEventListener("keydown", handleKey);
    onCleanup(() => document.removeEventListener("keydown", handleKey));
  });

  const tl   = () => props.paper.citation_timeline ?? [];
  const reps = () => props.paper.record?.replications ?? [];
  const totalCit  = () => tl().reduce((s, d) => s + d.only + d.with_failed + d.with_mixed + d.with_successful, 0);
  const coCit     = () => tl().reduce((s, d) => s + d.with_failed + d.with_mixed + d.with_successful, 0);

  return (
    <div class="cim-backdrop" onClick={handleBackdrop}>
      <div class="cim-modal" role="dialog" aria-modal="true" aria-label="Citation timeline">

        {/* ── Header ── */}
        <div class="cim-header">
          <div class="cim-header-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="12" width="4" height="9" /><rect x="10" y="7" width="4" height="14" /><rect x="17" y="3" width="4" height="18" />
            </svg>
            <span class="cim-title">Citation Timeline</span>
          </div>
          <button class="cim-close" onClick={props.onClose} aria-label="Close">✕</button>
        </div>

        <Show
          when={tl().length > 0}
          fallback={
            <div class="cim-empty">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              No citation data available yet for this paper.
            </div>
          }
        >

          {/* ── KPI band ── */}
          <div class="cim-kpi-band">
            <div class="cim-kpi">
              <div class="cim-kpi-val">{totalCit().toLocaleString()}</div>
              <div class="cim-kpi-lbl">Total citations</div>
            </div>
            <div class="cim-kpi-div" />
            <div class="cim-kpi">
              <div class="cim-kpi-val">{coCit().toLocaleString()}</div>
              <div class="cim-kpi-lbl">Co-cited with rep</div>
            </div>
            <div class="cim-kpi-div" />
            <div class="cim-kpi">
              <div class="cim-kpi-val">{reps().length}</div>
              <div class="cim-kpi-lbl">Replications</div>
            </div>
          </div>

          {/* ── Chart ── */}
          <div class="cim-chart-area">
            <StackedBarChart data={tl()} reps={reps()} />
          </div>

          {/* ── Footer: legend + footnote ── */}
          <div class="cim-footer">
            <div class="cim-legend">
              <For each={LEGEND}>
                {(item) => (
                  <span class="cim-leg-item">
                    <span class="cim-swatch" style={{ background: item.color }} />
                    {item.label}
                  </span>
                )}
              </For>
            </div>
            <p class="cim-footnote">
              OpenCitations · weekly ·{" "}
              <a href={`https://doi.org/${props.paper.doi}`} target="_blank" rel="noreferrer">
                {props.paper.doi}
              </a>
            </p>
          </div>

        </Show>
      </div>
    </div>
  );
};
