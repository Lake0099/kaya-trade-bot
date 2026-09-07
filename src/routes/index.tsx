import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gold Desk AI — ICT/SMC Gold Sidebar" },
      {
        name: "description",
        content:
          "Live gold sidebar with ICT/SMC AI analysis, screen sharing and trade plans. Preview the Chrome side panel and download the extension.",
      },
      { property: "og:title", content: "Gold Desk AI — ICT/SMC Gold Sidebar" },
      {
        property: "og:description",
        content:
          "Preview the Gold Desk side panel live and download the Chrome extension.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function download() {
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
}

function Home() {
  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
        <section className="flex-1">
          <h1 className="text-2xl font-semibold">Gold Desk AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Yeh bilkul wahi panel hai jo Chrome sidebar mein khulta hai. Yahin test karein —
            price, timeframe, chat aur chart upload sab live chalte hain. (Screen share sirf
            extension ke andar chalega.)
          </p>

          <button
            onClick={download}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Download extension (.zip)
          </button>

          <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>ZIP unzip karein.</li>
            <li>
              Chrome mein <code>chrome://extensions</code> kholein.
            </li>
            <li>Developer mode on karein (top-right).</li>
            <li>“Load unpacked” par click karke folder select karein.</li>
            <li>Toolbar icon dabate hi sidebar khul jayega.</li>
          </ol>
        </section>

        <section className="shrink-0">
          <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
            <iframe
              src="/extension-preview/sidepanel.html"
              title="Gold Desk sidebar preview"
              className="block h-[720px] w-[380px] bg-white"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
