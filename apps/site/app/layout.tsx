import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EventPort — Change Detection for AI Agents",
    template: "%s — EventPort",
  },
  description:
    "Aggregate webhooks from any platform into a unified event stream your local AI agent can consume.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "EventPort — Change Detection for AI Agents",
    description:
      "Aggregate webhooks from any platform into a unified event stream your local AI agent can consume.",
    siteName: "EventPort",
    locale: "en_US",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "EventPort" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EventPort — Change Detection for AI Agents",
    description:
      "Aggregate webhooks from any platform into a unified event stream your local AI agent can consume.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  authors: [{ name: "EventPort" }],
  creator: "EventPort",
  publisher: "EventPort",
  applicationName: "EventPort",
  keywords: [
    "AI agent",
    "webhook",
    "change detection",
    "event gateway",
    "webhook relay",
    "webhook inbox",
    "AI agent inbox",
    "event stream",
    "developer tools",
    "open source",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
