/**
 * Status badge: enabled (green) / disabled (red), with a same-color dot.
 * Based on shadcn Badge, only overrides the color scheme.
 */

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

import style from "./style.module.css";

interface StatusBadgeProps {
  /** true = normal/enabled, false = disabled/revoked */
  active: boolean;
  children: ReactNode;
}

export default function StatusBadge({ active, children }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={active ? style.active : style.revoked}>
      {children}
    </Badge>
  );
}
