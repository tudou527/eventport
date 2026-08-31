"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconRss, IconSettings, IconTimelineEventText } from "@tabler/icons-react";

import { useI18n } from "@/app/dashboard/i18n";
import style from "./style.module.css";

interface NavMenuProps {
  showAdmin: boolean;
}

const navMenu = ({ showAdmin }: NavMenuProps) => {
  const pathname = usePathname();
  const { t } = useI18n();

  const items = [
    { href: "/dashboard/", label: t("nav.subscriptions"), icon: IconRss },
    { href: "/dashboard/events/", label: t("nav.events"), icon: IconTimelineEventText },
    ...(showAdmin
      ? [{ href: "/dashboard/admin/", label: t("nav.admin"), icon: IconSettings }]
      : []),
  ];

  return (
    <nav className={style.nav}>
      {items.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/dashboard/"
            ? pathname === "/dashboard" || pathname === "/dashboard/"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={style.navItem}
            data-active={isActive ? "true" : "false"}
          >
            <Icon stroke={2} size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
};

export default navMenu;
