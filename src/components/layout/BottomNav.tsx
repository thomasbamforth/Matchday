"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconLeagues({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v2a6 6 0 01-12 0V4z" />
      <path d="M6 6C6 10 9 13 12 14s6-4 6-8" />
      <path d="M12 14v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

function IconBoosts({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",    Icon: IconHome },
  { href: "/leagues",   label: "Leagues", Icon: IconLeagues },
  { href: "/boosts",    label: "Boosts",  Icon: IconBoosts },
  { href: "/profile",   label: "Profile", Icon: IconProfile },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-aubergine/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-xl items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={[
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
                  active ? "text-hot-pink" : "text-white/40 hover:text-white/70",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
