"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";

interface LeagueSummary {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  isOwner: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Copy-code button (reused per league row)
// ---------------------------------------------------------------------------

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); copy(); }}
      className="ml-1 font-mono text-white/60 hover:text-white transition-colors"
      aria-label="Copy invite code"
      title="Copy invite code"
    >
      {copied ? (
        <span className="text-neon-green text-[10px] font-bold">Copied!</span>
      ) : (
        <span>{code}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeaguesPage() {
  const router = useRouter();
  const { data: leagues, isLoading, mutate } = useSWR<LeagueSummary[]>("/api/leagues", fetcher);

  const [newName, setNewName]   = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining]   = useState(false);
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError]     = useState("");

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create league");
      }
      const league = await res.json();
      await mutate();
      router.push(`/league/${league.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to join league");
      }
      const league = await res.json();
      await mutate();
      router.push(`/league/${league.id}`);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-white">Leagues</h1>
        <p className="mt-1 text-sm text-white/50">
          Compete with your mates. Create a league or join one with an invite code.
        </p>
      </header>

      {/* ---- Existing leagues ---- */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
          Your leagues
        </h2>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between rounded-xl border border-white/10 px-4 py-3"
              >
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-white/10" />
                  <div className="h-3 w-24 rounded bg-white/5" />
                </div>
                <div className="h-3 w-10 rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && leagues?.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 px-4 py-8 text-center">
            <p className="text-sm text-white/50">You're not in any leagues yet.</p>
            <p className="mt-1 text-xs text-white/30">
              Create one below or ask a mate for their invite code.
            </p>
          </div>
        )}

        {/* League list */}
        {!isLoading && leagues && leagues.length > 0 && (
          <div className="space-y-2">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/league/${l.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{l.name}</p>
                    {l.isOwner && (
                      <span className="shrink-0 rounded bg-hot-pink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-hot-pink">
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                    {l.memberCount} member{l.memberCount !== 1 ? "s" : ""}
                    <span className="text-white/20">·</span>
                    <CopyCodeButton code={l.code} />
                  </p>
                </div>
                <span className="ml-4 shrink-0 text-xs text-hot-pink">View →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- Create a league ---- */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-1 text-sm font-bold text-white">Create a league</h2>
        <p className="mb-3 text-xs text-white/40">
          You'll get a shareable invite code to send to your mates.
        </p>

        {createError && (
          <p className="mb-3 rounded-lg bg-hot-pink/20 px-3 py-2 text-xs text-hot-pink">
            {createError}
          </p>
        )}

        <form onSubmit={createLeague} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
            placeholder="League name"
            maxLength={40}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-hot-pink"
          />
          <button
            type="submit"
            disabled={creating || newName.trim().length < 2}
            className="rounded-lg bg-hot-pink px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      {/* ---- Join with a code ---- */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-1 text-sm font-bold text-white">Join with a code</h2>
        <p className="mb-3 text-xs text-white/40">
          Ask the league owner for their 8-character invite code.
        </p>

        {joinError && (
          <p className="mb-3 rounded-lg bg-hot-pink/20 px-3 py-2 text-xs text-hot-pink">
            {joinError}
          </p>
        )}

        <form onSubmit={joinLeague} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
            placeholder="A3F1B2C4"
            maxLength={8}
            spellCheck={false}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm uppercase tracking-widest text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-hot-pink"
          />
          <button
            type="submit"
            disabled={joining || joinCode.length < 4}
            className="rounded-lg bg-hot-pink px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
      </section>
    </div>
  );
}
