import type { Metadata, Viewport } from "next";
import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchday",
  description: "Predict. Compete. Dominate.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
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
