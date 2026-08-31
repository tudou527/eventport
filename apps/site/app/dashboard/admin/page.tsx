"use client";

import { useEffect, useState } from "react";
import {
  fetchAllUsers,
  fetchAllTokens,
  toggleUserDisabled,
  toggleSubscriptionDisabled,
  updateRateLimit,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/app/dashboard/components/pageHeader";
import StatusBadge from "@/app/dashboard/components/statusBadge";
import { useI18n } from "@/app/dashboard/i18n";
import { toast } from "sonner";

import style from "./style.module.css";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  provider: string;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: number;
}

interface TokenRow {
  id: string;
  userId: string;
  subscriptionId: string;
  label: string | null;
  apiKey: string;
  role: "webhook" | "consumer";
  rateLimit: number;
  createdAt: number;
  revokedAt: number | null;
  disabled?: boolean;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { t, formatDate } = useI18n();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [usersResult, tokensResult] = await Promise.all([
      fetchAllUsers(),
      fetchAllTokens(),
    ]);

    if (usersResult.error || tokensResult.error) {
      toast.error(usersResult.error || tokensResult.error || t("admin.loadFailed"));
      setLoading(false);
      return;
    }

    setUsers(usersResult.users ?? []);

    // Aggregate webhook + consumer rows into one subscription row for display.
    const bySub = new Map<string, TokenRow>();
    for (const t of tokensResult.tokens ?? []) {
      const existing = bySub.get(t.subscriptionId);
      if (!existing || t.createdAt > existing.createdAt) {
        bySub.set(t.subscriptionId, t);
      }
    }
    setTokens(Array.from(bySub.values()));
    setLoading(false);
  };

  const handleToggleUser = async (userId: string, disabled: boolean) => {
    setPendingId(userId);
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("disabled", String(disabled));
    const result = await toggleUserDisabled(formData);
    setPendingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, disabled } : u))
    );
  };

  const handleToggleSubscription = async (subscriptionId: string, disabled: boolean) => {
    setPendingId(subscriptionId);
    const formData = new FormData();
    formData.set("subscriptionId", subscriptionId);
    formData.set("disabled", String(disabled));
    const result = await toggleSubscriptionDisabled(formData);
    setPendingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setTokens((prev) =>
      prev.map((t) =>
        t.subscriptionId === subscriptionId ? { ...t, disabled } : t
      )
    );
  };

  const handleRateLimitChange = async (
    subscriptionId: string,
    value: string
  ) => {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit < 1) {
      return;
    }

    const formData = new FormData();
    formData.set("subscriptionId", subscriptionId);
    formData.set("rateLimit", String(limit));
    const result = await updateRateLimit(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setTokens((prev) =>
      prev.map((t) =>
        t.subscriptionId === subscriptionId ? { ...t, rateLimit: limit } : t
      )
    );
  };

  return (
    <>
      <PageHeader title={t("admin.title")} lead={t("admin.lead")} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("admin.tab.users")}</TabsTrigger>
          <TabsTrigger value="subscriptions">{t("admin.tab.subscriptions")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Table className={style.adminTable}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.col.email")}</TableHead>
                <TableHead>{t("admin.col.provider")}</TableHead>
                <TableHead>{t("admin.col.admin")}</TableHead>
                <TableHead>{t("admin.col.status")}</TableHead>
                <TableHead>{t("admin.col.created")}</TableHead>
                <TableHead className={style.actionCol}>{t("admin.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {u.email}
                    {u.name && (
                      <span className={style.userName}>
                        ({u.name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{u.provider}</TableCell>
                  <TableCell>{u.isAdmin ? t("admin.yes") : t("admin.no")}</TableCell>
                  <TableCell>
                    <StatusBadge active={!u.disabled}>
                      {u.disabled ? t("admin.disabled") : t("admin.active")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt * 1000)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${u.disabled ? "" : style.dangerAction} ${style.actionBtn}`}
                      disabled={pendingId === u.id}
                      onClick={() => handleToggleUser(u.id, !u.disabled)}
                    >
                      {pendingId === u.id ? <Loader2 className="animate-spin" /> : u.disabled ? t("admin.enable") : t("admin.disable")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Table className={style.adminTable}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.col.label")}</TableHead>
                <TableHead>{t("admin.col.id")}</TableHead>
                <TableHead>{t("admin.col.owner")}</TableHead>
                <TableHead>{t("admin.col.rateLimit")}</TableHead>
                <TableHead>{t("admin.col.status")}</TableHead>
                <TableHead>{t("admin.col.created")}</TableHead>
                <TableHead className={style.actionCol}>{t("admin.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((row) => {
                const owner = users.find((u) => u.id === row.userId);
                const isDisabled = row.revokedAt ? true : !!row.disabled;
                return (
                  <TableRow key={row.id} className={row.revokedAt ? style.revokedRow : undefined}>
                    <TableCell>{row.label || row.subscriptionId}</TableCell>
                    <TableCell>
                      <code>{row.subscriptionId}</code>
                    </TableCell>
                    <TableCell>{owner?.email || row.userId}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        defaultValue={row.rateLimit}
                        onBlur={(e) =>
                          handleRateLimitChange(row.subscriptionId, e.target.value)
                        }
                        className={style.rateLimitInput}
                      />
                    </TableCell>
                    <TableCell>
                      {row.revokedAt ? (
                        <StatusBadge active={false}>{t("admin.revoked")}</StatusBadge>
                      ) : (
                        <StatusBadge active={!isDisabled}>
                          {isDisabled ? t("admin.disabled") : t("admin.active")}
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(row.createdAt * 1000)}</TableCell>
                    <TableCell>
                      {!row.revokedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={`${isDisabled ? "" : style.dangerAction} ${style.actionBtn}`}
                          disabled={pendingId === row.subscriptionId}
                          onClick={() =>
                            handleToggleSubscription(row.subscriptionId, !isDisabled)
                          }
                        >
                          {pendingId === row.subscriptionId ? <Loader2 className="animate-spin" /> : isDisabled ? t("admin.enable") : t("admin.disable")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </>
  );
}
