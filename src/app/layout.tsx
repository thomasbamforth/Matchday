import type { Metadata } from "next";
import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchday",
  description: "Predict. Compete. Dominate.",
  manifest: "/manifest.json",
  themeColor: "#2D0A31",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
