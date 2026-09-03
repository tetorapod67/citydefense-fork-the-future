import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityDefense: Fork the Future",
  description: "A server-backed Gate 1 proof surface for two WebMCP Site Tools.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
