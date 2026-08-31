/**
 * DeepSeek Harness setup guide — renders install.md via react-markdown inside
 * the shared site chrome.
 */

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SiteLayout from "@/components/siteLayout";
import { GATEWAY_URL } from "@/lib/env";
import installMd from "./install.md";

import style from "@/app/agent/style.module.css";

export const metadata: Metadata = {
  title: "DeepSeek Harness Setup",
  description:
    "Install the EventPort adapter for DeepSeek Harness (dsh): save the plugin files, start dsh web with the overlay, and let the agent consume your webhook events.",
};

export default function Page() {
  return (
    <SiteLayout activeAdapter="dsh">
      <div className={style.markdownBody}>
        {/* {{GATEWAY_URL}} placeholders are replaced at render time so the
            docs never hardcode a deployment-specific gateway URL. */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{installMd.replaceAll("{{GATEWAY_URL}}", GATEWAY_URL)}</ReactMarkdown>
      </div>
    </SiteLayout>
  );
}
