import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TF = z.enum(["15m", "1h", "4h", "1d"]);

const Body = z.object({
  action: z.enum(["snapshot", "analyze", "chat"]),
  timeframe: TF.default("1h"),
  mode: z.enum(["technical", "sentiment", "plan"]).optional(),
  question: z.string().max(4000).optional(),
  chartImage: z.string().max(6_000_000).optional(),
  screenImage: z.string().max(6_000_000).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) }))
    .max(20)
    .optional(),
});

const MODE_PROMPT: Record<string, string> = {
  technical:
    "Do a technical read: market structure (BOS/CHoCH), trend, momentum, key support/resistance, and what invalidates the view.",
  sentiment:
    "Give a macro & sentiment read for gold right now: rates, USD, risk appetite, typical drivers. Be explicit that you have no live news feed and reason from the price action plus general macro knowledge.",
  plan: "Give a concrete trade plan: bias, entry zone (POI), stop loss, TP1/TP2, risk-reward, and conditions to stand aside.",
};

const EXPERT_SYSTEM = `You are "Gold Desk AI" — a gold (XAU/USD) trading analyst with 25+ years of institutional experience (prop desk, London/NY sessions).

Your method is ICT / Smart Money Concepts, applied strictly:
- Market structure: BOS, CHoCH, swing highs/lows, internal vs external liquidity.
- Liquidity: buy-side/sell-side liquidity pools, equal highs/lows, stop raids, liquidity sweeps before reversal.
- PD arrays: order blocks (OB), breaker blocks, fair value gaps (FVG/imbalance), mitigation blocks, premium vs discount of the dealing range (50% equilibrium).
- Time: Asian range, London open killzone, New York open killzone, judas swing, silver bullet window, daily/weekly opening gaps.
- Confluence with classic tools: EMA 20/50/200, RSI, ATR for stop sizing, session highs/lows, round numbers.
- Risk first: define invalidation before entry, size by ATR, never chase.

Style: talk like a senior mentor — direct, no fluff, no hype. Use short markdown headings and bullets. Always give concrete price levels and an invalidation level. If the user writes Urdu/Hindi/Roman-Urdu, reply in the same language. If you are shown a screen or chart image, describe exactly what you see (pair, timeframe, structure, levels) before giving the read. Never promise profits; end with a one-line risk note.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

async function callAi(key: string, messages: unknown[], maxTokens: number) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    if (res.status === 429) return { error: "Rate limited — thodi der baad try karein.", status: 429 };
    if (res.status === 402) return { error: "AI credits khatam ho gaye.", status: 402 };
    return { error: `AI request failed [${res.status}]`, status: 500 };
  }
  const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: out.choices?.[0]?.message?.content ?? "No analysis returned." };
}

export const Route = createFileRoute("/api/public/gold")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const { fetchCandles, fetchTicker, computeTechnicals } = await import(
          "@/lib/market.server"
        );
        const [candles, ticker] = await Promise.all([
          fetchCandles(body.timeframe, 300),
          fetchTicker(),
        ]);
        const technicals = computeTechnicals(candles);

        if (body.action === "snapshot") {
          return json({ ticker, technicals, timeframe: body.timeframe });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI is not configured" }, 500);

        const context = JSON.stringify({ ticker, technicals, timeframe: body.timeframe });

        if (body.action === "chat") {
          const parts: unknown[] = [
            {
              type: "text",
              text:
                `Live gold data (PAXG/USDT, tracks XAU/USD, timeframe ${body.timeframe}):\n${context}\n\n` +
                (body.screenImage
                  ? "The image below is the user's shared browser screen right now — read the chart/content on it and answer accordingly.\n\n"
                  : "") +
                `User: ${body.question ?? "Screen ko parho aur ab kya karna chahiye batao."}`,
            },
          ];
          const shot = body.screenImage ?? body.chartImage;
          if (shot) parts.push({ type: "image_url", image_url: { url: shot } });

          const history = (body.history ?? []).map((m) => ({
            role: m.role,
            content: m.text,
          }));

          const result = await callAi(
            key,
            [
              { role: "system", content: EXPERT_SYSTEM },
              ...history,
              { role: "user", content: parts },
            ],
            1600,
          );
          if ("error" in result) return json({ error: result.error }, result.status);
          return json({ text: result.text, ticker, technicals });
        }

        const mode = body.mode ?? "technical";
        const userContent: unknown[] = [
          {
            type: "text",
            text:
              `${MODE_PROMPT[mode]}\n\nLive gold (PAXG/USDT, tracks XAU/USD) data:\n${context}` +
              (body.question ? `\n\nUser question: ${body.question}` : "") +
              (body.chartImage ? "\n\nAlso read the attached chart screenshot." : ""),
          },
        ];
        if (body.chartImage) {
          userContent.push({ type: "image_url", image_url: { url: body.chartImage } });
        }

        const result = await callAi(
          key,
          [
            { role: "system", content: EXPERT_SYSTEM },
            { role: "user", content: userContent },
          ],
          1400,
        );
        if ("error" in result) return json({ error: result.error }, result.status);
        return json({ text: result.text, ticker, technicals });
      },
    },
  },
});
