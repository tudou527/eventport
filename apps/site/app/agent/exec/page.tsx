/**
 * Generic agent setup guide — renders install.md via react-markdown
 * inside the shared site chrome.
 */

import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SiteLayout from "@/components/siteLayout";
import { GATEWAY_URL } from "@/lib/env";
import installMd from "./install.md";

import style from "@/app/agent/style.module.css";

export const metadata: Metadata = {
  title: "Any Agent Setup",
  description:
    "Install the EventPort consumer for any agent: save event-port.mjs, schedule your own session to run it, and process the events it prints.",
};

export default function Page() {
  return (
    <SiteLayout activeAdapter="exec">
      <div className={style.markdownBody}>
        {/* {{GATEWAY_URL}} placeholders are replaced at render time so the
            docs never hardcode a deployment-specific gateway URL. */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{installMd.replaceAll("{{GATEWAY_URL}}", GATEWAY_URL)}</ReactMarkdown>
      </div>
    </SiteLayout>
  );
}
