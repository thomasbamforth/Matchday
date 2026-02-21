import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BottomNav from "@/components/layout/BottomNav";
import FcmRegistrar from "@/components/layout/FcmRegistrar";

/**
 * Authenticated app shell.
 * Redirects unauthenticated users to the sign-in page.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  return (
    <div className="relative min-h-screen bg-aubergine pb-20">
      <FcmRegistrar />
      <main className="mx-auto max-w-xl px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
