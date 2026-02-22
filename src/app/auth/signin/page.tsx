import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import SignInButtons from "./SignInButtons";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aubergine px-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-white">Matchday</h1>
          <p className="mt-1 text-sm text-white/50">Predict. Compete. Dominate.</p>
        </div>

        <SignInButtons />

        <p className="mt-6 text-center text-xs text-white/30">
          By signing in you agree to play fair and take the banter.
        </p>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-white/30 hover:text-white/60">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
