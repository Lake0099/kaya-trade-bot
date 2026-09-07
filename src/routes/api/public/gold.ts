import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TF = z.enum(["15m", "1h", "4h", "1d"]);

const Body = z.object({
  action: z.enum(["snapshot", "analyze"]),
  timeframe: TF,
  mode: z.enum(["technical", "sentiment", "plan"]).optional(),
  question: z.string().max(1000).optional(),
  chartImage: z.string().max(6_000_000).optional(),
});

const MODE_PROMPT: Record<string, string> = {
  technical:
    "Do a technical read: trend, momentum, key support/resistance, and what invalidates the view.",
  sentiment:
    "Give a macro & sentiment read for gold right now: rates, USD, risk appetite, typical drivers. Be explicit that you have no live news feed and reason from the price action plus general macro knowledge.",
  plan: "Give a concrete trade plan: bias, entry zone, stop loss, TP1/TP2, risk-reward, and conditions to stand aside.",
};

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

        const mode = body.mode ?? "technical";
        const context = JSON.stringify({ ticker, technicals, timeframe: body.timeframe });
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

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            reasoning_effort: "low",
            max_completion_tokens: 1400,
            messages: [
              {
                role: "system",
                content:
                  "You are a disciplined gold (XAU/USD) trading analyst. Be concise and structured with short markdown headings and bullets. Always include concrete price levels. End with a one-line risk disclaimer. Never promise profits.",
              },
              { role: "user", content: userContent },
            ],
          }),
        });

        if (!res.ok) {
          if (res.status === 429) return json({ error: "Rate limited — thodi der baad try karein." }, 429);
          if (res.status === 402) return json({ error: "AI credits khatam ho gaye." }, 402);
          return json({ error: `AI request failed [${res.status}]` }, 500);
        }

        const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return json({
          text: out.choices?.[0]?.message?.content ?? "No analysis returned.",
          ticker,
          technicals,
        });
      },
    },
  },
});
