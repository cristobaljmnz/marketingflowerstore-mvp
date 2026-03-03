import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "flowerstore.ph — Ad Generator",
  description: "Agent-driven marketing automation for flowerstore.ph",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
