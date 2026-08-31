"use client";

/**
 * Dashboard i18n (zh/en) via React context.
 *
 * The initial locale is resolved on the server (cookie `eventport-lang` →
 * Accept-Language → en) and passed in by the dashboard layout, so SSR and
 * hydration always agree — no language flash on first paint. Switching calls
 * setLocale(), which writes the cookie so the choice survives reloads.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { translate, type Locale, type TKey } from "./dict";

const LANG_COOKIE = "eventport-lang";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key, interpolating {param} placeholders. */
  t: (key: TKey, params?: Record<string, string | number>) => string;
  /** Locale-aware date/time formatting (zh-CN / en-US). */
  formatDate: (timestamp: number) => string;
  formatDateTime: (timestamp: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const dateLocale = (locale: Locale) => (locale === "zh" ? "zh-CN" : "en-US");

export const I18nProvider = ({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep <html lang> in sync for a11y / font rendering.
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  const formatDate = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleDateString(dateLocale(locale)),
    [locale],
  );

  const formatDateTime = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleString(dateLocale(locale)),
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, formatDate, formatDateTime }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
};

export type { Locale };
