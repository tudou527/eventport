"use client";

/**
 * Source-specific webhook setup guidance (Payload URL / secret / provider
 * steps). Shared by the create flow (dashboard/new) and the subscription
 * detail page so the config info stays visible after creation.
 *
 * The config is rendered as a stacked label/value list (not a <table>) so
 * long values (Payload URL / Secret / Events) wrap naturally on mobile and
 * are never truncated.
 */
import CodeBlock from "@/app/dashboard/components/codeBlock";
import { useI18n } from "@/app/dashboard/i18n";

import style from "./style.module.css";

export interface GuidanceProps {
  sourceId: string;
  webhookUrl: string;
  signingSecret: string;
}

export function SourceGuidance({ sourceId, webhookUrl, signingSecret }: GuidanceProps) {
  const { t } = useI18n();

  switch (sourceId) {
    case "github":
      return (
        <div className={style.setupStep}>
          <div className={style.header}>
            <div className={style.title}>{t("guidance.github.title")}</div>
            <p>
              {t("guidance.github.intro.pre")}{" "}
              <strong>{t("guidance.github.intro.nav")}</strong>{" "}
              {t("guidance.github.intro.post")}
            </p>
          </div>
          <div className={`${style.content} ${style.githubContent}`}>
            <CodeBlock label={t("guidance.payloadUrl")} value={webhookUrl} />
            <div className={style.fieldItem}>
              <label>{t("guidance.contentType")}</label>
              <div className={style.fieldContent}>application/json</div>
            </div>
            <div>
              <CodeBlock label={t("guidance.secret")} value={signingSecret} />
              <p className={style.note}>
                {t("guidance.github.secretNote")}
              </p>
            </div>
            <div className={style.fieldItem}>
              <label>{t("guidance.events")}</label>
              <div className={style.fieldContent}>
                {t("guidance.github.events.pre")}{" "}
                <strong>{t("guidance.github.events.option")}</strong>{" "}
                {t("guidance.github.events.mid")} <code>Pull requests</code>
                {t("guidance.github.events.sep")}
                <code>Issues</code>
                {t("guidance.github.events.post")}
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className={style.setupStep}>
          <div className={style.header}>
            <div className={style.title}>{t("guidance.default.title")}</div>
            <p>{t("guidance.default.desc")}</p>
          </div>
          <div className={style.content}>
            <CodeBlock value={webhookUrl} />
          </div>
        </div>
      );
  }
}