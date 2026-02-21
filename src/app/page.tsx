import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aubergine px-6 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight">Matchday</h1>
        <p className="mt-3 text-lg text-white/60">Predict. Compete. Dominate.</p>

        <Link
          href="/auth/signin"
          className="mt-10 inline-block rounded-xl bg-hot-pink px-8 py-3 text-base font-bold text-white transition-opacity hover:opacity-90"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
