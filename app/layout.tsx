import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credify — Evidence Intelligence",
  description:
    "Protocol-enforced credibility, context, provenance, and adversarial verification.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
