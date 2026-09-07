import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { analyzeGold, getGoldSnapshot } from "@/lib/gold.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gold Desk — Live XAU/USD AI Analysis Panel" },
      {
        name: "description",
        content:
          "A compact side panel with live gold prices, support and resistance levels, and AI trade plans you can keep open beside your chart.",
      },
      { property: "og:title", content: "Gold Desk — Live XAU/USD AI Analysis Panel" },
      {
        property: "og:description",
        content:
          "Live gold price, technical levels, sentiment reads and AI trade plans in a narrow always-open panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoldPanel,
});

const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
type Mode = "technical" | "sentiment" | "plan";

const MODES: { id: Mode; label: string }[] = [
  { id: "technical", label: "Technical" },
  { id: "sentiment", label: "Sentiment" },
  { id: "plan", label: "Trade plan" },
];

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${34 - ((p - min) / span) * 32}`)
    .join(" ");
  const up = points[points.length - 1]! >= points[0]!;
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        points={d}
        fill="none"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className={up ? "stroke-bull" : "stroke-bear"}
      />
    </svg>
  );
}

function Formatted({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1" />;
        if (line.startsWith("#"))
          return (
            <h3 key={i} className="pt-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
              {line.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
            </h3>
          );
        const bullet = /^[-*•]\s+/.test(line);
        return (
          <p
            key={i}
            className={`text-[13px] leading-relaxed text-foreground/85 ${bullet ? "pl-3 -indent-3" : ""}`}
          >
            {bullet ? "— " : ""}
            {line.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "")}
          </p>
        );
      })}
    </div>
  );
}

function GoldPanel() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [mode, setMode] = useState<Mode>("technical");
  const [question, setQuestion] = useState("");
  const [chartImage, setChartImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const snapshotFn = useServerFn(getGoldSnapshot);
  const analyzeFn = useServerFn(analyzeGold);

  const snapshot = useQuery({
    queryKey: ["gold", timeframe],
    queryFn: () => snapshotFn({ data: { timeframe } }),
    refetchInterval: 15000,
  });

  const analysis = useMutation({
    mutationFn: () =>
      analyzeFn({
        data: {
          timeframe,
          mode,
          ...(question.trim() ? { question: question.trim() } : {}),
          ...(chartImage ? { chartImage } : {}),
        },
      }),
  });

  const t = snapshot.data?.technicals;
  const ticker = snapshot.data?.ticker;
  const up = (ticker?.changePercent ?? 0) >= 0;

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setChartImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col border-x border-border bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Gold Desk</h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            XAU/USD · live
          </p>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">
          AI analyst
        </span>
      </header>

      <section className="border-b border-border bg-surface/60 px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-accent">
          Chrome sidebar extension — Gemini style
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Chrome ke side panel me chat khulti hai. "Share screen" dabayein aur AI aap ka chart live
          dekh kar ICT/SMC (structure, liquidity, OB/FVG, entry, stop, targets) ke hisab se jawab
          deta hai — 25+ saal ke analyst ki tarah.
        </p>
        <button
          onClick={() => {
            fetch("/gold-desk-extension.zip")
              .then((res) => {
                if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                return res.blob();
              })
              .then((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "gold-desk-extension.zip";
                a.click();
                URL.revokeObjectURL(a.href);
              })
              .catch((err) => alert(err.message));
          }}
          className="mt-3 w-full rounded-md border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent"
        >
          Download extension (.zip)
        </button>
        <ol className="mt-3 space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground [list-style:decimal]">
          <li>Zip file ko unzip karein.</li>
          <li>Chrome me chrome://extensions kholein.</li>
          <li>Upar dayen "Developer mode" on karein.</li>
          <li>"Load unpacked" par click kar ke unzipped folder chunein.</li>
          <li>Toolbar me Gold Desk icon dabayein — sidebar khul jayegi.</li>
        </ol>
      </section>

      <section className="border-b border-border px-4 py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {ticker ? ticker.price.toFixed(2) : "—"}
            </div>
            <div className={`text-xs font-medium ${up ? "text-bull" : "text-bear"}`}>
              {ticker ? `${up ? "▲" : "▼"} ${ticker.changePercent.toFixed(2)}% · 24h` : "loading…"}
            </div>
          </div>
          <div className="w-28">{t ? <Spark points={t.closes} /> : null}</div>
        </div>

        <div className="mt-3 flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                timeframe === tf
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </section>

      {t ? (
        <section className="grid grid-cols-2 gap-px border-b border-border bg-border">
          {[
            ["Trend", t.trend],
            ["RSI 14", String(t.rsi14)],
            ["EMA 20", t.ema20.toFixed(2)],
            ["EMA 50", t.ema50.toFixed(2)],
            ["ATR 14", t.atr14.toFixed(2)],
            ["EMA 200", t.ema200.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} className="bg-background px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
              <div className="font-mono text-sm text-foreground">{v}</div>
            </div>
          ))}
        </section>
      ) : null}

      {t ? (
        <section className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-bear">Resistance</div>
              {t.resistance.length ? (
                t.resistance.map((r) => (
                  <div key={r.level} className="font-mono text-xs text-foreground/80">
                    {r.level.toFixed(2)}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-bull">Support</div>
              {t.support.length ? (
                t.support.map((r) => (
                  <div key={r.level} className="font-mono text-xs text-foreground/80">
                    {r.level.toFixed(2)}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex-1 px-4 py-4">
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                mode === m.id
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Optional: ask something specific…"
          className="mt-2 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
        />

        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {chartImage ? "Chart attached ✓" : "Attach chart"}
          </button>
          {chartImage ? (
            <button
              onClick={() => setChartImage(null)}
              className="text-[11px] text-muted-foreground hover:text-bear"
            >
              remove
            </button>
          ) : null}
        </div>

        <button
          onClick={() => analysis.mutate()}
          disabled={analysis.isPending}
          className="mt-3 w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {analysis.isPending ? "Analysing…" : "Run analysis"}
        </button>

        {analysis.isError ? (
          <p className="mt-3 rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
            {(analysis.error as Error).message}
          </p>
        ) : null}

        {analysis.data ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3">
            <Formatted text={analysis.data.text} />
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Keep this panel open next to your chart. Pick a timeframe, choose what you want, and run
            the analysis — levels and momentum are read from live gold data.
          </p>
        )}
      </section>

      <footer className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Price feed: PAXG/USDT (gold-backed, tracks spot gold). Educational use only — not financial
        advice.
      </footer>
    </main>
  );
}
