import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { env } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "Webhook Dashboard Alerts",
  description:
    "Production-ready webhook ingestion, event dashboard, and alerting workflow.",
};

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.25),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.22),transparent_38%)]" />
        {children}
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasClerkKeys =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
    process.env.CLERK_SECRET_KEY?.startsWith("sk_");

  if (env.devBypassAuth || !hasClerkKeys) {
    return <AppFrame>{children}</AppFrame>;
  }

  return (
    <ClerkProvider>
      <AppFrame>{children}</AppFrame>
    </ClerkProvider>
  );
}
