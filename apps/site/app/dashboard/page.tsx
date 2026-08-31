"use client";
import { useEffect, useState } from "react";
import { IconPlus } from '@tabler/icons-react';
import { toast } from "sonner";

import {
  createToken,
  fetchSubscriptions,
  deleteSubscription,
  type SubscriptionWithConfig,
} from "@/app/actions";
import EmptyState from "@/app/dashboard/components/emptyState";
import NewSubscriptionDialog from "@/app/dashboard/components/newSubscriptionDialog";
import PageHeader from "@/app/dashboard/components/pageHeader";
import SubscriptionCard from "@/app/dashboard/components/subscriptionCard";
import { useI18n } from "@/app/dashboard/i18n";
import { Button } from "@/components/ui/button";

import style from "./style.module.css";

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { t } = useI18n();

  // Reload the subscription list, then expand the card whose id matches the
  // URL's ?subscription= param (or the one passed in). Reused by both the
  // initial page load and the post-create flow.
  const loadAndExpand = async (subscriptionId?: string) => {
    if (subscriptionId) {
      const url = new URL(window.location.href);
      url.searchParams.set("subscription", subscriptionId);
      window.history.replaceState({}, "", url);
    }
    const id =
      subscriptionId ??
      new URLSearchParams(window.location.search).get("subscription");
    await loadSubscriptions();
    if (id) {
      setExpandedId(id);
    }
  };

  useEffect(() => {
    loadAndExpand();
  }, []);

  const loadSubscriptions = async () => {
    const result = await fetchSubscriptions();
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSubscriptions(result.subscriptions ?? []);
  };

  const handleDelete = async (subscriptionId: string) => {
    const formData = new FormData();
    formData.set("subscriptionId", subscriptionId);
    const result = await deleteSubscription(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    loadSubscriptions();
  };

  const handleCreated = (result: Awaited<ReturnType<typeof createToken>>) => {
    if (!result.subscriptionId) {
      return;
    }
    setNewOpen(false);
    // D1 reads can lag briefly behind a just-committed write; wait a moment
    // before reloading so the new row is visible.
    setTimeout(() => {
      loadAndExpand(result.subscriptionId);
    }, 500);
  };

  const renderSkeleton = () => {
    return [1, 2, 3].map((i) => (
      <div key={i} className={style.skeletonCard}>
        <div className={style.skeletonBasic}>
          <div className={style.skeletonLogo} />
          <div className={style.skeletonTitle} />
          <div className={style.skeletonMeta} />
        </div>
        <div className={style.skeletonChevron} />
      </div>
    ));
  };

  const renderEmpty = () => {
    return (
      <EmptyState
        title={t("subs.empty.title")}
        description={t("subs.empty.desc")}
        tags={["GitHub", "Stripe", "Linear", "Shopify", "Slack", "+4 more"]}
        action={
          <Button onClick={() => setNewOpen(true)}>
            {t("subs.empty.cta")}
          </Button>
        }
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t("subs.title")}
        lead={t("subs.lead")}
        action={<Button onClick={() => setNewOpen(true)}><IconPlus stroke={1.5} size={12} />{t("subs.new")}</Button>}
      />

      <div className={style.subList}>
        {loading ? (
          renderSkeleton()
        ) : subscriptions.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {subscriptions.map((s) => (
              <SubscriptionCard
                key={s.subscriptionId}
                subscription={s}
                onDelete={handleDelete}
                defaultOpen={s.subscriptionId === expandedId}
              />
            ))}
          </>
        )}
      </div>

      <NewSubscriptionDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
