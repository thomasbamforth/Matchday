import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

const FEATURES = [
  {
    heading: "Predict every match",
    body: "Pick exact scorelines for all 10 top-flight fixtures each gameweek. Exact score: 3 pts. Correct result: 1 pt.",
  },
  {
    heading: "Boost chips & special picks",
    body: "Use your Away Day Pick to double points when an away team wins. Activate a Boost Chip to go double-or-nothing on your whole gameweek.",
  },
  {
    heading: "Compete with your mates",
    body: "Private leagues, live leaderboards, and a deadpan AI pundit who recaps the gameweek with banter proportional to how badly you played.",
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col bg-aubergine px-6 text-white">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <h1 className="text-5xl font-black tracking-tight">Matchday</h1>
        <p className="mt-3 text-lg text-white/60">Predict. Compete. Dominate.</p>

        <Link
          href="/auth/signin"
          className="mt-10 inline-block rounded-xl bg-hot-pink px-8 py-3.5 text-base font-bold text-white transition-opacity hover:opacity-90"
        >
          Get started
        </Link>
        <p className="mt-3 text-xs text-white/30">Free. No ads. No official PL branding.</p>
      </div>

      {/* Feature list */}
      <div className="mx-auto w-full max-w-sm space-y-4 pb-16">
        {FEATURES.map((f) => (
          <div
            key={f.heading}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <p className="text-sm font-bold text-hot-pink">{f.heading}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
