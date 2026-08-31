"use client";

/**
 * Subscription row: collapsible card.
 * Collapsed: single row with label / source / created time.
 * Expanded: webhook config, agent prompt, test event, delete action.
 *
 * Uses the native <details>/<summary> element so no extra JS state or
 * collapsible dependency is needed (also keyboard + a11y friendly).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconTrash } from "@tabler/icons-react";

import { testWebhook, updateInstructions, type SubscriptionWithConfig } from "@/app/actions";
import CodeBlock from "@/app/dashboard/components/codeBlock";
import { SourceGuidance } from "@/app/dashboard/components/sourceGuidance";
import { useEnv } from "@/app/dashboard/envProvider";
import { useI18n } from "@/app/dashboard/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import style from "./style.module.css";

/** Agents with a setup guide under /agent/*; the picker defaults to the first. */
const AGENTS = [
  { id: "dsh", label: "DeepSeek Harness" },
  { id: "pi", label: "Pi" },
  { id: "exec", label: "Any Agent" },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

interface SubscriptionCardProps {
  subscription: SubscriptionWithConfig;
  onDelete: (subscriptionId: string) => void;
  /** Whether to initially expand this card (e.g. newly created subscription). */
  defaultOpen?: boolean;
}

export default function SubscriptionCard({
  subscription,
  onDelete,
  defaultOpen = false,
}: SubscriptionCardProps) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [agent, setAgent] = useState<AgentId>("dsh");
  const [instructions, setInstructions] = useState(subscription.instructions);
  const [saving, startSaving] = useTransition();
  const { t, formatDate } = useI18n();
  const { siteUrl, gatewayUrl } = useEnv();

  // Expand the card imperatively when defaultOpen turns true, while keeping the
  // native <details> toggle uncontrolled so the user can still collapse it.
  useEffect(() => {
    if (defaultOpen && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [defaultOpen]);

  const {
    subscriptionId,
    label,
    source,
    signingSecret,
    webhookKey,
    consumerKey,
    disabled,
    createdAt,
  } = subscription;

  const webhookUrl = webhookKey
    ? `${gatewayUrl}/hooks/${webhookKey}`
    : `${gatewayUrl}/hooks/{api-key}`;

  // Per-agent onboarding instructions: one guide sentence plus the real
  // credentials, ready to paste to the selected agent as-is.
  const agentPrompt = consumerKey
    ? t("card.agent.prompt", {
        guideUrl: `${siteUrl}/agent/${agent}/`,
        gatewayUrl,
        consumerKey,
      })
    : t("card.agent.tokenUnavailable");

  const handleTest = async () => {
    if (!webhookKey) {
      return;
    }
    setTestLoading(true);
    const result = await testWebhook(webhookKey);
    setTestLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.push(`/dashboard/events/?subscription=${subscriptionId}`);
  };

  const handleSaveInstructions = () => {
    const formData = new FormData();
    formData.set("subscriptionId", subscriptionId);
    formData.set("instructions", instructions);
    startSaving(async () => {
      const result = await updateInstructions(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("card.instructions.saved"));
    });
  };

  return (
    <details ref={detailsRef} className={style.card}>
      <summary className={style.summary}>
        <div className={style.basic}>
          <img className={style.logo} src={`/logo/${source.toLowerCase()}.png`} />
          <span className={style.title}>{label}</span>
          {disabled && <span className={style.disabledBadge}>{t("card.disabled")}</span>}
          <span className={style.meta}>
            {t("card.created", { date: formatDate(createdAt * 1000) })}
          </span>
        </div>
        <div className={style.chevron} aria-hidden>
          <IconChevronDown size={16} stroke={2} />
        </div>
      </summary>
      <Tabs defaultValue="webhook" className={style.tabs}>
        <TabsList>
          <TabsTrigger value="webhook">{t("card.tab.webhook")}</TabsTrigger>
          <TabsTrigger value="agent">{t("card.tab.agent")}</TabsTrigger>
        </TabsList>
        <TabsContent value="webhook">
          <SourceGuidance
            sourceId={source}
            webhookUrl={webhookUrl}
            signingSecret={signingSecret ?? ""}
          />

        </TabsContent>
        <TabsContent value="agent">
          <p className={style.agentInfo}>
            {t("card.agent.infoPrefix")}
            <Select
              value={agent}
              onValueChange={(value) => setAgent(value as AgentId)}
            >
              <SelectTrigger size="sm" className={style.agentSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENTS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {t("card.agent.infoSuffix")}
          </p>
          <CodeBlock value={agentPrompt} multiline />
          <div className={style.instructions}>
            <div className={style.instructionsHeader}>
              <span className={style.instructionsTitle}>
                {t("card.instructions.title")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveInstructions}
                disabled={saving}
              >
                {saving ? t("card.instructions.saving") : t("card.instructions.save")}
              </Button>
            </div>
            <p className={style.instructionsHint}>{t("card.instructions.hint")}</p>
            <textarea
              className={style.instructionsInput}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("card.instructions.placeholder")}
              rows={4}
            />
          </div>
        </TabsContent>
      </Tabs>
      <div className={style.footer}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!webhookKey || testLoading || disabled}
        >
          {testLoading ? t("card.testing") : t("card.test")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <IconTrash size={14} stroke={2} />
              {t("card.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("card.delete.title", { label: label || subscriptionId })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("card.delete.desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("card.delete.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onDelete(subscriptionId)}
              >
                {t("card.delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </details>
  );
}
