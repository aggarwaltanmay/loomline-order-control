import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loomline — order control",
  description: "Early warnings and daily floor progress for knitwear exports.",
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
