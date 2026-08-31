/**
 * Shared site chrome: sticky header (logo, nav with an Agents dropdown,
 * Console button) and footer. Used by the landing page (app/home) and the
 * agent setup pages (app/agent/*) so every public page carries the same
 * navigation.
 */

import Link from "next/link";

import { GITHUB_URL } from "@/lib/env";

import ConsoleUser from "./consoleUser";

import style from "./style.module.css";

interface AgentLink {
  id: "dsh" | "pi" | "exec";
  label: string;
  href: string;
}

const AGENTS: AgentLink[] = [
  { id: "dsh", label: "DeepSeek Harness", href: "/agent/dsh/" },
  { id: "pi", label: "Pi", href: "/agent/pi/" },
  { id: "exec", label: "Any Agent", href: "/agent/exec/" },
];

interface SiteLayoutProps {
  /** Highlight this adapter in the Agents dropdown (agent setup pages). */
  activeAdapter?: AgentLink["id"];
  children: React.ReactNode;
}

function GithubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.16.58.67.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" /></svg>
  );
}

export default function SiteLayout({ activeAdapter, children }: SiteLayoutProps) {
  return (
    <div className={style.page}>
      <header className={style.header}>
        <div className={`${style.container} ${style.headerInner}`}>
          <Link className={style.logo} href="/">
            <img src="/logo.png" alt="EventPort" />
            <span>EventPort</span>
          </Link>
          <input type="checkbox" id="nav-toggle" className={style.navToggle} aria-label="Toggle navigation" />
          <label htmlFor="nav-toggle" className={style.navBurger} aria-hidden>
            <span />
            <span />
            <span />
          </label>
          <nav className={style.nav}>
            <a href="/#how-it-works">How it works</a>
            <a href="/#sources">Sources</a>
            <a href="/#features">Features</a>
            <a href="/#faq">FAQ</a>
            <div className={style.navDropdown}>
              <button type="button" className={style.navDropdownToggle}>
                Agents
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <div className={style.dropdownMenu}>
                {AGENTS.map((agent) => (
                  <a
                    key={agent.id}
                    href={agent.href}
                    className={agent.id === activeAdapter ? style.navActive : undefined}
                  >
                    {agent.label}
                  </a>
                ))}
              </div>
            </div>
            <a href={GITHUB_URL} className={style.navGithub} target="_blank" rel="noreferrer" aria-label="GitHub repository">
              <GithubMark />
            </a>
          </nav>
          <ConsoleUser />
        </div>
      </header>

      <main>{children}</main>

      <footer className={style.footer}>
        <div className={`${style.container} ${style.footerInner}`}>
          <div className={style.footerBrand}>
            <a href="/" className={style.logo}><span className={style.logoDot} />EventPort</a>
            <p>Change detection for AI agents.</p>
          </div>
          <div className={style.footerCol}>
            <h4>Product</h4>
            <a href="/#sources">Sources</a>
            <a href="/#features">Features</a>
            <a href="/#faq">FAQ</a>
          </div>
          <div className={style.footerCol}>
            <h4>Resources</h4>
            <a href="/#how-it-works">How it works</a>
            <a href="/#faq">FAQ</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">Docs</a>
          </div>
          <div className={style.footerCol}>
            <h4>Company</h4>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className={`${style.container} ${style.footerBottom}`}>
          <p>&copy; 2026 EventPort. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
