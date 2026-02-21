import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SignInButtons from "./SignInButtons";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aubergine px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-black text-white">Matchday</h1>
        <p className="mb-8 text-center text-sm text-white/50">
          Sign in to make your predictions
        </p>
        <SignInButtons />
      </div>
    </main>
  );
}
