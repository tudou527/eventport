"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";

import { sendLoginCode, verifyLoginCode } from "@/app/actions";
import { useI18n } from "@/app/dashboard/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import style from "./style.module.css";

type Phase = "email" | "code";

/** OAuth callback error codes → i18n keys (see dict.ts `login.oauth.*`). */
const OAUTH_ERROR_KEYS: Record<string, Parameters<ReturnType<typeof useI18n>["t"]>[0]> = {
  missing_code: "login.oauth.missing_code",
  token_exchange_failed: "login.oauth.token_exchange_failed",
  userinfo_failed: "login.oauth.userinfo_failed",
  no_email: "login.oauth.no_email",
  account_disabled: "login.oauth.account_disabled",
  login_failed: "login.oauth.login_failed",
};

export default function LoginForm({
  googleEnabled,
  oauthError,
}: {
  googleEnabled: boolean;
  oauthError: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  // Surface OAuth callback errors (redirected back with ?error=xxx).
  useEffect(() => {
    if (oauthError) {
      const key = OAUTH_ERROR_KEYS[oauthError];
      toast.error(key ? t(key) : t("login.oauth.login_failed"));
    }
    // Run once per error value; t is re-created per render so it's excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthError]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("login.err.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(t("login.err.emailInvalid"));
      return;
    }
    setLoading(true);
    const result = await sendLoginCode(email);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPhase("code");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error(t("login.err.codeRequired"));
      return;
    }
    setLoading(true);
    const result = await verifyLoginCode(email, code);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    }
    // On success, verifyLoginCode redirects to /dashboard/
  };

  return (
    <>
      <div className={style.authCard}>
      <h1>{t("login.title")}</h1>
      <p className={style.cardLead}>{t("login.lead")}</p>

      {phase === "email" ? (
        <form onSubmit={handleSendCode}>
          <div className={style.formGroup}>
            <Label htmlFor="email">{t("login.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              autoFocus
            />
          </div>
          <Button type="submit" className={style.authSubmit} disabled={loading}>
            {loading && <IconLoader2 stroke={2} size={16} className="animate-spin" />}
            {loading ? t("login.sendingCode") : t("login.submitEmail")}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <p className={style.authHint}>
            {t("login.codeSent")} <strong>{email}</strong>.{" "}
            <Button
              type="button"
              variant="link"
              className={style.textButton}
              onClick={() => { setPhase("email"); setCode(""); }}
            >
              {t("login.differentEmail")}
            </Button>
          </p>
          <div className={style.formGroup}>
            <Label htmlFor="code">{t("login.codeLabel")}</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("login.codePlaceholder")}
              maxLength={6}
              autoFocus
            />
          </div>
          <Button type="submit" className={style.authSubmit} disabled={loading}>
            {loading && <IconLoader2 stroke={2} size={16} className="animate-spin" />}
            {loading ? t("login.verifying") : t("login.submitCode")}
          </Button>
          <p className={`${style.authHint} ${style.resendHint}`}>
            {t("login.notReceived")}{" "}
            <Button
              type="button"
              variant="link"
              className={style.textButton}
              onClick={handleSendCode}
              disabled={loading}
            >
              {t("login.resend")}
            </Button>
          </p>
        </form>
      )}

      {googleEnabled && (
        <>
          <div className={style.authDivider}>{t("login.divider")}</div>

          <Button asChild variant="outline" className={`${style.authSubmit} ${style.googleButton}`}>
            <a href="/api/auth/google">
              <svg className={style.googleIcon} width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("login.continueGoogle")}
            </a>
          </Button>
        </>
      )}
    </div>

      <p className={style.authFooter}>
        <Link href="/">{t("login.backHome")}</Link>
      </p>
    </>
  );
}
