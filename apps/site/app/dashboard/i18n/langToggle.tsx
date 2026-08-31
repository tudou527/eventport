"use client";

/**
 * Single zh/en toggle button: click to switch to the other language
 * (persisted in the eventport-lang cookie).
 * The label shows the language it will switch TO (zh → "EN", en → "中").
 * Accepts an optional `className` so it can be styled in non-dashboard contexts
 * (e.g. login page) by passing in a local CSS module class.
 */
import { useI18n } from ".";
import dashboardStyle from "@/app/dashboard/style.module.css";

const LangToggle = ({ className }: { className?: string }) => {
  const { locale, setLocale } = useI18n();
  const cls = className ?? dashboardStyle.langToggle;
  const next = locale === "zh" ? "en" : "zh";
  const label = locale === "zh" ? "Switch to English" : "切换为中文";

  return (
    <div className={cls}>
      <button
        type="button"
        onClick={() => setLocale(next)}
        title={label}
        aria-label={label}
      >
        {next === "zh" ? "中" : "EN"}
      </button>
    </div>
  );
};

export default LangToggle;
