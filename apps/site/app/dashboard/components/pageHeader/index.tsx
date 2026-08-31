/**
 * Page header: title + lead copy + primary action on the right.
 * Shared across dashboard pages to keep the title area layout and divider consistent.
 */

import type { ReactNode } from "react";

import style from "./style.module.css";

interface PageHeaderProps {
  title: string;
  lead?: ReactNode;
  /** Primary action area on the right (usually a Button) */
  action?: ReactNode;
}

export default function PageHeader({ title, lead, action }: PageHeaderProps) {
  return (
    <div className={style.pageHeader}>
      <div>
        <div className={style.title}>{title}</div>
        {lead && <p className={style.lead}>{lead}</p>}
      </div>
      {action && <div className={style.action}>{action}</div>}
    </div>
  );
}
