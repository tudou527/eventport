/**
 * Pi setup guide — renders install.md via react-markdown inside the shared
 * site chrome.
 */

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SiteLayout from "@/components/siteLayout";
import { GATEWAY_URL } from "@/lib/env";
import installMd from "./install.md";

import style from "@/app/agent/style.module.css";

export const metadata: Metadata = {
  title: "Pi Setup",
  description:
    "Install the EventPort hook for Pi (pi-mono): drop the poller into ~/.pi/agent/hooks, start pi with EG_URL and EG_TOKEN, and events flow into the session.",
};

export default function Page() {
  return (
    <SiteLayout activeAdapter="pi">
      <div className={style.markdownBody}>
        {/* {{GATEWAY_URL}} placeholders are replaced at render time so the
            docs never hardcode a deployment-specific gateway URL. */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{installMd.replaceAll("{{GATEWAY_URL}}", GATEWAY_URL)}</ReactMarkdown>
      </div>
    </SiteLayout>
  );
}
