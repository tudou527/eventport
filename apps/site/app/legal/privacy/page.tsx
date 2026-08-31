/**
 * Privacy Policy — renders privacy.md inside the shared site chrome.
 * Styling is reused from the agent setup pages (markdown body).
 */

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SiteLayout from "@/components/siteLayout";
import privacyMd from "./privacy.md";

import style from "@/app/agent/style.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What the hosted EventPort service stores: your email, subscription config, and event payloads — consumed on read and deleted within minutes.",
  alternates: {
    canonical: "/legal/privacy/",
  },
};

export default function Page() {
  return (
    <SiteLayout>
      <div className={style.markdownBody}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacyMd}</ReactMarkdown>
      </div>
    </SiteLayout>
  );
}
