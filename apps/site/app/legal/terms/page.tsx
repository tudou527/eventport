/**
 * Terms of Service — renders terms.md inside the shared site chrome.
 * Styling is reused from the agent setup pages (markdown body).
 */

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SiteLayout from "@/components/siteLayout";
import termsMd from "./terms.md";

import style from "@/app/agent/style.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for the hosted EventPort service: at-most-once delivery, fair-use quotas, acceptable use, and open-source licensing.",
  alternates: {
    canonical: "/legal/terms/",
  },
};

export default function Page() {
  return (
    <SiteLayout>
      <div className={style.markdownBody}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{termsMd}</ReactMarkdown>
      </div>
    </SiteLayout>
  );
}
