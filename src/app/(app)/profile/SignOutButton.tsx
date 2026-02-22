"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full rounded-xl border border-hot-pink/30 bg-hot-pink/10 py-3 text-sm font-bold text-hot-pink transition-opacity hover:opacity-80"
    >
      Sign out
    </button>
  );
}
