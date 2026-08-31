"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { IconRefresh } from '@tabler/icons-react';

import { fetchStoredEvents, fetchTokens, type StoredEvent } from "@/app/actions";
import EmptyState from "@/app/dashboard/components/emptyState";
import PageHeader from "@/app/dashboard/components/pageHeader";
import { useI18n } from "@/app/dashboard/i18n";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import style from "./style.module.css";

/** Option value for "all subscriptions" in the dropdown (Select does not accept an empty string) */
const ALL = "all";

const EventsContent = () => {
  const searchParams = useSearchParams();
  const initialSub = searchParams.get("subscription");
  const { t, formatDateTime } = useI18n();

  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    { id: string; label: string | null }[]
  >([]);
  const [filter, setFilter] = useState(initialSub ?? ALL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    loadEvents(filter);
  }, [filter]);

  const loadSubscriptions = async () => {
    const result = await fetchTokens();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const bySub = new Map<string, string | null>();
    for (const t of result.tokens ?? []) {
      if (t.revokedAt) {
        continue;
      }
      if (!bySub.has(t.subscriptionId)) {
        bySub.set(t.subscriptionId, t.label);
      }
    }
    setSubscriptions(
      Array.from(bySub.entries()).map(([id, label]) => ({ id, label }))
    );
  };

  const loadEvents = async (subscriptionId: string) => {
    setLoading(true);
    const result = await fetchStoredEvents(
      subscriptionId === ALL ? undefined : subscriptionId
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEvents(result.events ?? []);
  };

  return (
    <>
      <PageHeader
        title={t("events.title")}
        lead={t("events.lead")}
        action={
          <Button variant="outline" onClick={() => loadEvents(filter)} disabled={loading}>
            <IconRefresh stroke={1.5} size={12} />
            {loading ? t("events.loading") : t("events.refresh")}
          </Button>
        }
      />

      <div className={style.filterRow}>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className={style.filterSelect}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("events.all")}</SelectItem>
            {subscriptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label || s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && events.length === 0 ? (
        <p className={style.placeholder}>{t("events.loadingEvents")}</p>
      ) : events.length === 0 ? (
        <EmptyState
          title={t("events.empty.title")}
          description={t("events.empty.desc")}
        />
      ) : (
        <Table className={style.eventsTable}>
          <TableHeader>
            <TableRow>
              <TableHead className={style.timeCol}>{t("events.col.time")}</TableHead>
              <TableHead className={style.subCol}>{t("events.col.subscription")}</TableHead>
              <TableHead className={style.idCol}>{t("events.col.messageId")}</TableHead>
              <TableHead>{t("events.col.payload")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <TableRow key={ev.messageId}>
                <TableCell className={style.timeCell}>
                  {formatDateTime(ev.timestamp)}
                </TableCell>
                <TableCell>{ev.subscriptionLabel || ev.subscriptionId}</TableCell>
                <TableCell>
                  <code className={style.eventId}>{ev.messageId}</code>
                </TableCell>
                <TableCell className={style.payloadCell}>
                  {JSON.stringify(ev.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};

export default function EventsPage() {
  return (
    <Suspense>
      <EventsContent />
    </Suspense>
  );
}
