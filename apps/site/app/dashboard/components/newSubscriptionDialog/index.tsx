"use client";

/**
 * New subscription dialog: dropdown to select platform + input for subscription name.
 * On success, callbacks the parent (refresh list and open the config dialog).
 */

import { useState } from "react";

import { createToken } from "@/app/actions";
import { useI18n } from "@/app/dashboard/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import style from "./style.module.css";

/** Platforms that support signature verification; custom is passthrough mode (no signature verification). */
const SOURCES = [
  { id: "github", name: "GitHub" },
  { id: "stripe", name: "Stripe" },
  { id: "linear", name: "Linear" },
  { id: "slack", name: "Slack" },
  { id: "shopify", name: "Shopify" },
  { id: "hubspot", name: "HubSpot" },
  { id: "calendly", name: "Calendly" },
  { id: "typeform", name: "Typeform" },
  { id: "custom", name: "Custom webhook" },
];

interface NewSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass back the full create result on success */
  onCreated: (result: Awaited<ReturnType<typeof createToken>>) => void;
}

export default function NewSubscriptionDialog({
  open,
  onOpenChange,
  onCreated,
}: NewSubscriptionDialogProps) {
  const [source, setSource] = useState("github");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const { t } = useI18n();

  /** Display name for a source id: platform brand names stay as-is, only the
   * "custom" entry is localized. */
  const sourceName = (id: string) =>
    id === "custom"
      ? t("dialog.source.custom")
      : SOURCES.find((s) => s.id === id)?.name ?? id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = label.trim();
    if (!trimmed) {
      setNameError(true);
      toast.error(t("dialog.error.nameRequired"));
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set("source", source);
    formData.set("label", trimmed);

    const result = await createToken(formData);
    setLoading(false);

    if (result.error || !result.subscriptionId) {
      toast.error(result.error ?? t("dialog.error.createFailed"));
      return;
    }

    // Reset form for next open
    setLabel("");
    setSource("github");
    onCreated(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.desc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={style.form}>
          <div className={style.field}>
            <Label htmlFor="source">{t("dialog.platform")}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="source">
                <SelectValue placeholder={t("dialog.platform.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {sourceName(s.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={style.field}>
            <Label htmlFor="label">{t("dialog.label")}</Label>
            <Input
              id="label"
              value={label}
              aria-invalid={nameError}
              onChange={(e) => {
                setLabel(e.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder={t("dialog.label.placeholder", { name: sourceName(source) })}
              autoFocus
            />
            <p className={style.hint}>
              {t("dialog.label.hint")}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? t("dialog.submitting") : t("dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
