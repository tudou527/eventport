import Link from "next/link";
import { IconLogout, IconMenu2, IconX } from '@tabler/icons-react';

import { logout, getCurrentUser } from "@/app/actions";
import NavMenu from "@/app/dashboard/components/navMenu";
import { Button } from "@/components/ui/button";
import { GATEWAY_URL, SITE_URL } from "@/lib/env";

import { EnvProvider } from "./envProvider";
import { I18nProvider } from "./i18n";
import LangToggle from "./i18n/langToggle";
import { getServerLocale } from "./i18n/server";

import style from "./style.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const locale = await getServerLocale();

  return (
    <EnvProvider siteUrl={SITE_URL} gatewayUrl={GATEWAY_URL}>
      <I18nProvider initialLocale={locale}>
        <div className={style.layout}>
          {/* Mobile nav toggle (checkbox hack, zero JS — same pattern as the landing page).
       * Hidden on desktop, shown + turns the sidebar into an off-canvas drawer on small screens. */}
          <input type="checkbox" id="ds-nav-toggle" className={style.navToggle} aria-label="Toggle navigation" />
          <label htmlFor="ds-nav-toggle" className={style.navBurger} aria-hidden>
            <IconMenu2 className={style.navBurgerIcon} stroke={2} size={22} />
            <IconX className={style.navBurgerIconClose} stroke={2} size={22} />
          </label>
          <aside className={style.sidebar}>
            <div className={style.header}>
              <Link href="/dashboard/" className={style.logo}>
                <img src="/logo.png" alt="EventPort" />
                <span>EventPort</span>
              </Link>
              <LangToggle />
            </div>
            <NavMenu showAdmin={user.isAdmin} />
            <div className={style.footer}>
              <div className={style.userInfo}>
                <div className={style.avatar}>
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className={style.username}>
                  {user.email.split('@')[0]}
                </div>
              </div>
              <form action={logout}>
                <Button type="submit" variant="link" className={style.linkAction}>
                  <IconLogout stroke={2} />
                </Button>
              </form>
            </div>
          </aside>
          {/* Backdrop dims + closes the drawer when tapped (mobile only) */}
          <label htmlFor="ds-nav-toggle" className={style.backdrop} aria-hidden>
            <span />
          </label>
          <main className={style.main}>
            <div className={style.content}>{children}</div>
          </main>
        </div>
      </I18nProvider>
    </EnvProvider>
  );
}
