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

export default function LeaguesPage() {
  const router = useRouter();
  const { data: leagues, mutate } = useSWR<LeagueSummary[]>("/api/leagues", fetcher);

  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create league");
      }
      const league = await res.json();
      await mutate();
      setNewName("");
      router.push(`/league/${league.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
      setJoinCode("");
      router.push(`/league/${league.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Leagues</h1>

      {error && (
        <p className="rounded-lg bg-hot-pink/20 px-3 py-2 text-sm text-hot-pink">{error}</p>
      )}

      {/* Loading skeleton */}
      {!leagues && (
        <section className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 animate-pulse"
            >
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/5" />
              </div>
              <div className="h-3 w-10 rounded bg-white/5" />
            </div>
          ))}
        </section>
      )}

      {/* Existing leagues */}
      {leagues && leagues.length > 0 && (
        <section className="space-y-2">
          {leagues.map((l) => (
            <Link
              key={l.id}
              href={`/league/${l.id}`}
              className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
            >
              <div>
                <p className="text-sm font-semibold text-white">{l.name}</p>
                <p className="text-xs text-white/40">
                  {l.memberCount} member{l.memberCount !== 1 ? "s" : ""} · Code:{" "}
                  <span className="font-mono text-white/60">{l.code}</span>
                </p>
              </div>
              <span className="text-xs text-hot-pink">View →</span>
            </Link>
          ))}
        </section>
      )}

      {/* Create */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 text-sm font-bold text-white">Create a league</h2>
        <form onSubmit={createLeague} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="League name"
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-hot-pink"
          />
          <button
            type="submit"
            disabled={creating || newName.trim().length < 2}
            className="rounded-lg bg-hot-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
        </form>
      </section>

      {/* Join */}
      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 text-sm font-bold text-white">Join with a code</h2>
        <form onSubmit={joinLeague} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            maxLength={8}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm uppercase text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-hot-pink"
          />
          <button
            type="submit"
            disabled={joining || joinCode.length < 4}
            className="rounded-lg bg-hot-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {joining ? "…" : "Join"}
          </button>
        </form>
      </section>
    </div>
  );
}
