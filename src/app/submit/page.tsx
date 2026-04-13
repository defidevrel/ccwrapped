"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AsciiBackground } from "@/components/ascii-background";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { TerminalLabel } from "@/components/ui/terminal-label";

const PLACEHOLDER = `{
  "version": 1,
  "stats": { "sessions": 0, "messages": 0, ... },
  "tools": { ... },
  ...
}`;

export default function SubmitPage() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setStatus("loading");
    setError("");

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Invalid JSON — check your syntax and try again.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/wrapped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error ||
          (res.status === 413
            ? "Payload too large (max 10KB)"
            : `Server error (${res.status})`);
        setError(msg);
        setStatus("error");
        return;
      }

      const { slug } = await res.json();
      router.push(`/w/${slug}`);
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      <AsciiBackground pattern="noise" opacity={0.04} speed="slow" />
      <div className="pointer-events-none fixed inset-0 grid-pattern opacity-30" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="font-mono text-sm tracking-tight">← ccwrapped</span>
          </a>
        </div>
        <Divider />
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <TerminalLabel variant="bracket">PASTE YOUR WRAPPED</TerminalLabel>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Submit Manually
            </h1>
            <p className="text-sm text-text-secondary max-w-md">
              Run{" "}
              <code className="text-code">npx @defidevrel/ccwrapped --dry-run</code>{" "}
              to generate your stats JSON, then paste it below.
            </p>
          </div>
        </div>

        <Card variant="terminal" className="mt-10 p-6" showCorners>
          <div className="flex flex-col gap-4">
            <label className="label" htmlFor="json-input">
              PAYLOAD JSON
            </label>
            <textarea
              id="json-input"
              value={json}
              onChange={(e) => {
                setJson(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder={PLACEHOLDER}
              rows={16}
              spellCheck={false}
              className="w-full resize-y rounded-sm border border-line bg-surface p-4 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />

            {status === "error" && (
              <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 font-mono text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              variant="default"
              size="lg"
              onClick={handleSubmit}
              disabled={!json.trim() || status === "loading"}
              className="w-full"
            >
              {status === "loading" ? "Submitting..." : "Generate Wrapped"}
            </Button>
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-text-muted">
            Or use{" "}
              <code className="text-code">npx @defidevrel/ccwrapped</code>{" "}
            to scan, submit, and open automatically — no paste needed.
          </p>
        </div>
      </main>
    </div>
  );
}
