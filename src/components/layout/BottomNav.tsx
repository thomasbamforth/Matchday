"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Home",    icon: "🏠" },
  { href: "/leagues",    label: "Leagues",  icon: "🏆" },
  { href: "/boosts",     label: "Boosts",   icon: "⚡" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-aubergine/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-xl items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={[
                  "flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-medium transition-colors",
                  active ? "text-hot-pink" : "text-white/40 hover:text-white/70",
                ].join(" ")}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
