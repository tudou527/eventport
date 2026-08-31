import Link from "next/link";

import LangToggle from "@/app/dashboard/i18n/langToggle";
import { I18nProvider } from "@/app/dashboard/i18n";
import { getServerLocale } from "@/app/dashboard/i18n/server";

import LoginForm from "./loginForm";
import style from "./style.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Read the optional Google OAuth vars directly: getSiteEnv() validates
  // required server-only vars, which would break this page's static
  // prerender in environments without them (local dev, CI).
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const locale = await getServerLocale();
  const { error } = await searchParams;

  return (
    <I18nProvider initialLocale={locale}>
      <main className={style.authPage}>
        {/* Language toggle, top-right corner */}
        <div className={style.langToggleRow}>
          <LangToggle className={style.langToggle} />
        </div>
        {/* Centered form panel */}
        <div className={style.formPanel}>
          <div className={style.formWrapper}>
            {/* Brand logo */}
            <Link href="/" className={style.mobileLogo}>
              <img src="/logo.png" alt="EventPort" />
              <span>EventPort</span>
            </Link>

            <LoginForm
              googleEnabled={googleEnabled}
              oauthError={error ?? null}
            />
          </div>
        </div>
      </main>
    </I18nProvider>
  );
}
