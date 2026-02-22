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
      {/* Warning icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-hot-pink/30 bg-hot-pink/10">
        <svg
          className="h-7 w-7 text-hot-pink"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 className="mt-5 text-xl font-bold text-white">Sign-in failed</h1>
      <p className="mt-2 max-w-xs text-sm text-white/60">{msg}</p>

      <Link
        href="/auth/signin"
        className="mt-8 rounded-xl bg-hot-pink px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
      >
        Try again
      </Link>

      <Link href="/" className="mt-4 text-xs text-white/30 hover:text-white/60">
        Back to home
      </Link>
    </main>
  );
}
