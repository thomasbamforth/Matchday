import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin:        "Could not start the sign-in flow. Please try again.",
  OAuthCallback:      "Something went wrong during sign-in. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try a different provider.",
  Callback:           "An unexpected error occurred. Please try again.",
  AccessDenied:       "Access was denied.",
  Default:            "An unexpected error occurred.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const msg = ERROR_MESSAGES[searchParams.error ?? ""] ?? ERROR_MESSAGES.Default;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aubergine px-6 text-center">
      <p className="text-4xl">😬</p>
      <h1 className="mt-4 text-xl font-bold text-white">Sign-in failed</h1>
      <p className="mt-2 text-sm text-white/60">{msg}</p>
      <Link
        href="/auth/signin"
        className="mt-6 rounded-xl bg-hot-pink px-6 py-2.5 text-sm font-bold text-white hover:opacity-90"
      >
        Try again
      </Link>
    </main>
  );
}
