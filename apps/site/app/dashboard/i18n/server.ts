/**
 * Server-side i18n for actions: resolves the request locale (eventport-lang
 * cookie → Accept-Language → en) and returns a bound translate function so
 * server action errors come back in the user's language.
 */
import { cookies, headers } from "next/headers";

import { translate, type Locale, type TKey } from "./dict";

const LANG_COOKIE = "eventport-lang";

export const getServerLocale = async (): Promise<Locale> => {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved === "zh" || saved === "en") return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.split(",")[0].trim().toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
};

/** Resolve the request locale, then return a translate function bound to it. */
export const serverT = async (): Promise<
  (key: TKey, params?: Record<string, string | number>) => string
> => {
  const locale = await getServerLocale();
  return (key, params) => translate(locale, key, params);
};
