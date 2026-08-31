/**
 * Landing page (home) content: hero, data flow diagram, three-step onboarding,
 * event sources, features, FAQ, and CTA. Header/footer chrome lives in
 * components/siteLayout. Rendered by app/page.tsx as the route entry.
 */

import SiteLayout from "@/components/siteLayout";
import { GITHUB_URL, SITE_URL } from "@/lib/env";

import style from "./style.module.css";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "EventPort",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: "Change detection for AI agents. Aggregate webhooks from any platform into a unified event stream your local AI agent can consume.",
  sameAs: [GITHUB_URL],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "EventPort",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: "Aggregate webhooks from any platform into a unified event stream your local AI agent can consume.",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
  ],
  featureList: [
    "Webhook aggregation",
    "Durable event queue",
    "Agent-driven polling",
    "Dual-token security",
    "Open source and self-hostable",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is change detection for AI agents?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It is the practice of monitoring external sources — today SaaS webhooks, with RSS, social media, and webpage monitoring on the roadmap — for changes, then delivering those changes as structured events to a local AI agent. EventPort is the infrastructure that makes this possible without exposing your machine to the internet.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from a webhook relay?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Webhook relay services forward HTTP requests to your machine in real time. If your machine is offline, the event is lost. EventPort takes a different approach: it persists every event in a durable queue, and your agent polls on its own schedule. Nothing is dropped, and no inbound connection is ever needed.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from changedetection.io?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "changedetection.io monitors webpages and sends notifications to humans via Slack, Discord, or email. EventPort aggregates many source types — not just webpages — and delivers structured events to an AI agent via a pull API, so your agent can programmatically react to changes.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to open a port on my machine?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Your agent polls the gateway for events over HTTPS. The gateway never connects inbound to your network.",
      },
    },
    {
      "@type": "Question",
      name: "What happens when my agent is offline?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Events accumulate in a durable queue. When your agent comes back online, it resumes polling and drains the queue. Events are consumed on read — once pulled, they are removed from the gateway, so make your processing logic reliable.",
      },
    },
    {
      "@type": "Question",
      name: "Can I self-host it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. It is open source and self-hostable. Deploy it on your own infrastructure in minutes.",
      },
    },
    {
      "@type": "Question",
      name: "Which sources are available today?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "GitHub, Stripe, Linear, Shopify, Slack, HubSpot, Typeform, Calendly, and any custom webhook are fully supported. RSS feeds, YouTube, X / Twitter, webpage monitoring, and email are on the roadmap.",
      },
    },
  ],
};

export default function Home() {
  return (
    <SiteLayout>
      <div className={style.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className={style.hero}>
          <div className={style.container}>
            <span className={style.heroBadge}>Change Detection for AI Agents</span>
            <h1>Every external change,<br />delivered to your local AI agent</h1>
            <p className={style.heroLead}>Give your desktop agents a durable public inbox. SaaS webhooks land in a queue; your agent pulls them on its own schedule — no open ports, nothing lost when you go offline.</p>
            <p className={style.trustLine}>Open source · Self-hostable</p>
            <div className={style.heroActions}>
              <a href="/login/" className={`${style.btn} ${style.btnPrimary}`}>Get started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></a>
              <a href={GITHUB_URL} className={`${style.btn} ${style.btnSecondary}`} target="_blank" rel="noreferrer"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.16.58.67.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" /></svg> View on GitHub</a>
            </div>
          </div>
        </section>

        <section className={`${style.section} ${style.flowSection}`} id="how-it-works">
          <div className={style.container}>
            <h2 className={style.sectionTitle}>One inbox for every change</h2>
            <p className={style.sectionSubtitle}>Webhooks land in a durable queue and your agent pulls events on its own schedule — nothing is lost when it goes offline.</p>
            <div className={style.flowDiagram}>
              <svg viewBox="0 0 920 340" className={style.flowSvg} role="img" aria-label="Data flow: external change sources feed into EventPort, which forwards to your local AI agent">
                <defs>
                  <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                    <path d="M0 0 L10 5 L0 10 Z" fill="var(--fg-muted)" />
                  </marker>
                  <marker id="flow-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                    <path d="M0 0 L10 5 L0 10 Z" fill="var(--accent)" />
                  </marker>
                </defs>
                <rect x="20" y="30" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="47" textAnchor="middle" className={style.flowNodeTitle}>GitHub</text>
                <text x="95" y="60" textAnchor="middle" className={style.flowNodeSub}>webhook</text>
                <rect x="20" y="80" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="97" textAnchor="middle" className={style.flowNodeTitle}>Stripe</text>
                <text x="95" y="110" textAnchor="middle" className={style.flowNodeSub}>webhook</text>
                <rect x="20" y="130" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="147" textAnchor="middle" className={style.flowNodeTitle}>RSS / Atom</text>
                <text x="95" y="160" textAnchor="middle" className={style.flowNodeSub}>roadmap</text>
                <rect x="20" y="180" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="197" textAnchor="middle" className={style.flowNodeTitle}>YouTube</text>
                <text x="95" y="210" textAnchor="middle" className={style.flowNodeSub}>roadmap</text>
                <rect x="20" y="230" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="247" textAnchor="middle" className={style.flowNodeTitle}>X / Twitter</text>
                <text x="95" y="260" textAnchor="middle" className={style.flowNodeSub}>roadmap</text>
                <rect x="20" y="280" width="150" height="38" rx="8" className={style.flowNode} />
                <text x="95" y="297" textAnchor="middle" className={style.flowNodeTitle}>Web Monitor</text>
                <text x="95" y="310" textAnchor="middle" className={style.flowNodeSub}>roadmap</text>

                <path d="M170,49 C240,49 290,165 360,165" className={style.flowConnector} markerEnd="url(#flow-arrow)" />
                <path d="M170,99 C240,99 290,165 360,165" className={style.flowConnector} markerEnd="url(#flow-arrow)" />
                <path d="M170,149 C240,149 290,165 360,165" className={style.flowConnectorDashed} markerEnd="url(#flow-arrow)" />
                <path d="M170,199 C240,199 290,165 360,165" className={style.flowConnectorDashed} markerEnd="url(#flow-arrow)" />
                <path d="M170,249 C240,249 290,165 360,165" className={style.flowConnectorDashed} markerEnd="url(#flow-arrow)" />
                <path d="M170,299 C240,299 290,165 360,165" className={style.flowConnectorDashed} markerEnd="url(#flow-arrow)" />

                <rect x="360" y="110" width="200" height="110" rx="12" className={style.flowNodeFocal} />
                <text x="460" y="145" textAnchor="middle" className={style.flowNodeTitle}>EventPort</text>
                <text x="460" y="165" textAnchor="middle" className={style.flowNodeSub}>your public inbox</text>
                <text x="460" y="183" textAnchor="middle" className={style.flowNodeSub}>every event, buffered</text>
                <text x="460" y="201" textAnchor="middle" className={style.flowNodeSub}>until your agent reads it</text>

                <path d="M560,165 L700,165" className={style.flowConnectorFocal} markerEnd="url(#flow-arrow-accent)" />
                <text x="630" y="155" textAnchor="middle" className={style.flowLabel}>poll</text>

                <rect x="700" y="125" width="180" height="80" rx="12" className={style.flowNode} />
                <text x="790" y="155" textAnchor="middle" className={style.flowNodeTitle}>AI Agent</text>
                <text x="790" y="173" textAnchor="middle" className={style.flowNodeSub}>your local machine</text>
                <text x="790" y="189" textAnchor="middle" className={style.flowNodeSub}>reads events locally</text>
              </svg>
            </div>
            <div className={style.flowLegend}>
              <span className={style.flowLegendItem}><span className={`${style.flowLegendLine} ${style.flowLegendSolid}`} />webhook (push)</span>
              <span className={style.flowLegendItem}><span className={`${style.flowLegendLine} ${style.flowLegendDashed}`} />polled by gateway (roadmap)</span>
              <span className={style.flowLegendItem}><span className={`${style.flowLegendLine} ${style.flowLegendAccent}`} />poll (pull)</span>
            </div>
          </div>
        </section>

        <section className={`${style.section} ${style.sectionAlt}`}>
          <div className={`${style.container} ${style.containerNarrow}`}>
            <h2 className={style.sectionTitle}>Three steps from webhook to local agent</h2>
            <p className={style.sectionSubtitle}>From sign-up to a live event stream in minutes.</p>
            <div className={style.steps}>
              <div className={style.step}>
                <span className={style.stepNumber}>1</span>
                <div>
                  <h3>Create a subscription</h3>
                  <p>Sign in to the console and create a subscription. You get a public webhook URL and a consumer token for your agent.</p>
                </div>
              </div>
              <div className={style.step}>
                <span className={style.stepNumber}>2</span>
                <div>
                  <h3>Connect your sources</h3>
                  <p>Paste the webhook URL into GitHub, Stripe, or any service that can POST JSON. Signature verification is built in for supported platforms.</p>
                </div>
              </div>
              <div className={style.step}>
                <span className={style.stepNumber}>3</span>
                <div>
                  <h3>Let your agent pull events</h3>
                  <p>Copy the polling instructions to your agent — OpenClaw, Codex, or any agent. It sets up its own schedule, pulls events, and processes them one by one.</p>
                </div>
              </div>
            </div>
            <div className={style.codeCard}>
              <code># Copy to your agent (OpenClaw, Codex, ...)<br /># It runs this flow every 60 seconds:<br />GET &lt;gateway-url&gt;/events?limit=1<br />Authorization: Bearer &lt;your-consumer-token&gt;<br /><br /># → process each pulled event</code>
            </div>
          </div>
        </section>

        <section className={style.section} id="sources">
          <div className={style.container}>
            <h2 className={style.sectionTitle}>The connectors we ship today</h2>
            <p className={style.sectionSubtitle}>Native webhook connectors for the platforms your agents already use — plus a custom endpoint for everything else.</p>
            <div className={style.sourceGrid}>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>GitHub</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Push events, pull requests, issues, releases, and deployments.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Stripe</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Payment intents, subscriptions, invoices, and dispute events.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Linear</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Issue updates, cycle changes, and project activity.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Shopify</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Orders, carts, fulfilment, and product updates.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Slack</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Messages, reactions, and workflow events.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>HubSpot</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Contacts, deals, and CRM object changes.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Typeform</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>New responses and form submissions.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Calendly</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Invites, cancellations, and reschedules.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Custom Webhook</h3><span className={`${style.badge} ${style.badgeAvailable}`}>Available</span></div><p>Any service that can POST JSON — bring your own.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>RSS / Atom</h3><span className={`${style.badge} ${style.badgeRoadmap}`}>Roadmap</span></div><p>New posts from any blog, podcast, or news feed.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>YouTube</h3><span className={`${style.badge} ${style.badgeRoadmap}`}>Roadmap</span></div><p>New video uploads from channels you subscribe to.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>X / Twitter</h3><span className={`${style.badge} ${style.badgeRoadmap}`}>Roadmap</span></div><p>New posts from accounts you follow.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Webpage Monitor</h3><span className={`${style.badge} ${style.badgeRoadmap}`}>Roadmap</span></div><p>Detect content changes on any URL.</p></div>
              <div className={style.sourceCard}><div className={style.sourceCardHeader}><h3>Email Inbox</h3><span className={`${style.badge} ${style.badgeRoadmap}`}>Roadmap</span></div><p>Parse incoming emails as events.</p></div>
            </div>
          </div>
        </section>

        <section className={`${style.section} ${style.sectionAlt}`} id="features">
          <div className={style.container}>
            <h2 className={style.sectionTitle}>Built for local-first agents</h2>
            <p className={style.sectionSubtitle}>A durable, public inbox that gives your desktop agents a single, reliable event stream.</p>
            <div className={style.bento}>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" /></svg>
                </div>
                <h3>Unified event stream</h3>
                <p>Webhooks from every platform land in the same queue. Your agent sees one consistent event format, regardless of source.</p>
              </div>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg></div>
                <h3>Persistent &amp; durable</h3>
                <p>Events persist and survive restarts. When your agent comes back online, it picks up right where it left off — nothing is dropped.</p>
              </div>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg></div>
                <h3>Dual-token security</h3>
                <p>Webhook tokens let platforms send events. Consumer tokens let your agent poll them. Role-based routes keep each token where it belongs.</p>
              </div>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.37.57-1.95l.56-.96a4 4 0 0 0 3.49-2.2l.03-.05a4 4 0 0 1 3.55-2.15l2.26-.02a3 3 0 0 0 2.96-2.49l.3-1.8a3 3 0 0 0-2.96-3.51H10" /><path d="M18 8.99V3" /><path d="M22 7l-4-3-4 3" /></svg></div>
                <h3>Instant public URLs</h3>
                <p>Each subscription gets a unique endpoint. No port forwarding, no tunnel setup, no exposing your machine to the internet.</p>
              </div>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></svg></div>
                <h3>Bring your own agent</h3>
                <p>Paste the consumer token and polling instructions into any agent — OpenClaw, Codex, DeepSeek Harness — or use the bundled adapters. Events flow in seconds.</p>
              </div>
              <div className={style.bentoCard}>
                <div className={style.featureIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.16.58.67.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" /></svg></div>
                <h3>Open source &amp; self-hostable</h3>
                <p>Open source and self-hostable. Deploy it on your own infrastructure and control the data, the domains, and the limits.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${style.section} ${style.sectionAlt}`} id="faq">
          <div className={`${style.container} ${style.containerNarrow}`}>
            <h2 className={style.sectionTitle}>Questions, answered</h2>
            <div className={style.faq}>
              <details className={style.faqItem}><summary>What is change detection for AI agents?</summary><p>It is the practice of monitoring external sources — today SaaS webhooks, with RSS, social media, and webpage monitoring on the roadmap — for changes, then delivering those changes as structured events to a local AI agent. EventPort is the infrastructure that makes this possible without exposing your machine to the internet.</p></details>
              <details className={style.faqItem}><summary>How is this different from a webhook relay?</summary><p>Webhook relay services forward HTTP requests to your machine in real time. If your machine is offline, the event is lost. EventPort takes a different approach: it persists every event in a durable queue, and your agent polls on its own schedule. Nothing is dropped, and no inbound connection is ever needed.</p></details>
              <details className={style.faqItem}><summary>How is this different from changedetection.io?</summary><p>changedetection.io monitors webpages and sends notifications to humans via Slack, Discord, or email. EventPort aggregates many source types — not just webpages — and delivers structured events to an AI agent via a pull API, so your agent can programmatically react to changes.</p></details>
              <details className={style.faqItem}><summary>Do I need to open a port on my machine?</summary><p>No. Your agent polls the gateway for events over HTTPS. The gateway never connects inbound to your network.</p></details>
              <details className={style.faqItem}><summary>What happens when my agent is offline?</summary><p>Events accumulate in a durable queue. When your agent comes back online, it resumes polling and drains the queue. Events are consumed on read — once pulled, they are removed from the gateway, so make your processing logic reliable.</p></details>
              <details className={style.faqItem}><summary>Can I self-host it?</summary><p>Yes. It is open source and self-hostable. Deploy it on your own infrastructure in minutes.</p></details>
              <details className={style.faqItem}><summary>Which sources are available today?</summary><p>GitHub, Stripe, Linear, Shopify, Slack, HubSpot, Typeform, Calendly, and any custom webhook are fully supported. RSS feeds, YouTube, X / Twitter, webpage monitoring, and email are on the roadmap.</p></details>
            </div>
          </div>
        </section>

        <section className={`${style.section} ${style.ctaSection}`}>
          <div className={style.container}>
            <h2 className={style.sectionTitle}>Give your agent a public inbox in minutes</h2>
            <p className={style.sectionSubtitle}>Open source, self-hostable, and free to start.</p>
            <a href="/login/" className={`${style.btn} ${style.btnPrimary}`}>Get started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
