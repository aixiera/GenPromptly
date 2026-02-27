"use client";

import { useMemo, useState } from "react";

type Mode = "clarity" | "structure" | "detail";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("clarity");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  async function onImprove() {
    setError("");
    setResult("");

    const text = prompt.trim();
    if (!text) {
      setError("Please paste a prompt first.");
      return;
    }
    if (text.length > 8000) {
      setError("Prompt too long (max 8000 chars).");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, mode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Request failed.");
        return;
      }
      setResult(data.result ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Prompt Polish</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Paste a prompt, choose a mode, and get a cleaner version in seconds.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium">Input Prompt</label>

              <div className="flex items-center gap-2">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  <option value="clarity">Improve clarity</option>
                  <option value="structure">Add structure</option>
                  <option value="detail">Make more detailed</option>
                </select>

                <button
                  onClick={onImprove}
                  disabled={!canSubmit}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Improving..." : "Improve"}
                </button>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste your prompt here..."
              className="mt-3 h-40 w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
            />

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Optimized Prompt</label>
              <button
                onClick={onCopy}
                disabled={!result}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy
              </button>
            </div>

            <textarea
              value={result}
              readOnly
              placeholder="Your improved prompt will appear here..."
              className="mt-3 h-40 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>
    </main>
  );
}