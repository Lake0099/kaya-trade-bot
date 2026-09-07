const API =
  "https://project--e6504850-5ce1-48e5-b564-6e4bbb878c19.lovable.app/api/public/gold";

const TIMEFRAMES = ["15m", "1h", "4h", "1d"];
const MODES = [
  { id: "technical", label: "Technical" },
  { id: "sentiment", label: "Sentiment" },
  { id: "plan", label: "Trade plan" },
];

let timeframe = "1h";
let mode = "technical";
let chartImage = null;

const $ = (id) => document.getElementById(id);

function tabs(container, items, current, onPick) {
  container.innerHTML = "";
  items.forEach((it) => {
    const b = document.createElement("button");
    b.className = "tab" + (it.id === current ? " active" : "");
    b.textContent = it.label;
    b.onclick = () => onPick(it.id);
    container.appendChild(b);
  });
}

function renderTabs() {
  tabs(
    $("tfs"),
    TIMEFRAMES.map((t) => ({ id: t, label: t })),
    timeframe,
    (id) => {
      timeframe = id;
      renderTabs();
      loadSnapshot();
    },
  );
  tabs($("modes"), MODES, mode, (id) => {
    mode = id;
    renderTabs();
  });
}

async function post(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function loadSnapshot() {
  try {
    const d = await post({ action: "snapshot", timeframe });
    const t = d.technicals;
    $("price").textContent = d.ticker.price.toFixed(2);
    const up = d.ticker.changePercent >= 0;
    const ch = $("change");
    ch.textContent = `${up ? "▲" : "▼"} ${d.ticker.changePercent.toFixed(2)}% · 24h`;
    ch.className = up ? "bull" : "bear";

    const cells = [
      ["Trend", t.trend],
      ["RSI 14", String(t.rsi14)],
      ["EMA 20", t.ema20.toFixed(2)],
      ["EMA 50", t.ema50.toFixed(2)],
      ["ATR 14", t.atr14.toFixed(2)],
      ["EMA 200", t.ema200.toFixed(2)],
    ];
    $("stats").innerHTML = cells
      .map(([k, v]) => `<div class="cell"><div class="cap">${k}</div><div class="val">${v}</div></div>`)
      .join("");

    const lvl = (arr) =>
      arr && arr.length
        ? arr.map((r) => `<div class="lvl">${r.level.toFixed(2)}</div>`).join("")
        : `<div class="muted">—</div>`;
    $("res").innerHTML = lvl(t.resistance);
    $("sup").innerHTML = lvl(t.support);
  } catch (e) {
    $("change").textContent = e.message;
    $("change").className = "bear";
  }
}

$("attach").onclick = () => $("file").click();
$("file").onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    chartImage = String(r.result);
    $("attach").textContent = "Chart attached ✓";
    $("clear").classList.remove("hidden");
  };
  r.readAsDataURL(f);
};
$("clear").onclick = () => {
  chartImage = null;
  $("file").value = "";
  $("attach").textContent = "Attach chart";
  $("clear").classList.add("hidden");
};

$("run").onclick = async () => {
  const btn = $("run");
  const out = $("out");
  btn.disabled = true;
  btn.textContent = "Analysing…";
  out.className = "out muted";
  out.textContent = "Working on it…";
  try {
    const d = await post({
      action: "analyze",
      timeframe,
      mode,
      question: $("q").value.trim() || undefined,
      chartImage: chartImage || undefined,
    });
    out.className = "out filled";
    out.textContent = d.text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
  } catch (e) {
    out.className = "out error";
    out.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Run analysis";
  }
};

renderTabs();
loadSnapshot();
setInterval(loadSnapshot, 20000);
