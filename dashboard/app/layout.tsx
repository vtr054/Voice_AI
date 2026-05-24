import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutboundAI Dashboard",
  description: "Multi-channel AI agent platform dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
