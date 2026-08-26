"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useTranslation } from "react-i18next";
import { StoreI18nProvider } from "@/components/store/i18n-provider";
import type { StoreBootstrap } from "@/lib/store/types";

type Phase = "login" | "enroll" | "verify" | "recover" | "recover_sent" | "reset" | "reset_done";

type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
} | null;

function browserSupabase(config: SupabasePublicConfig) {
  return config ? createBrowserClient(config.url, config.publishableKey) : null;
}

function AdminAuthForm({ bootstrap, initialPhase, authConfig }: {
  bootstrap: StoreBootstrap;
  initialPhase: "login" | "mfa" | "recover" | "reset";
  authConfig: SupabasePublicConfig;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>(initialPhase === "mfa" ? "verify" : initialPhase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function prepareMfa() {
    const supabase = browserSupabase(authConfig);
    if (!supabase) return setMessage(String(t("admin.loginError")));
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) return setMessage(String(t("admin.mfaError")));
    const verified = factors.totp.find((factor) => factor.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setPhase("verify");
      return;
    }
    const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: bootstrap.settings.brandName,
    });
    if (enrollmentError) return setMessage(String(t("admin.mfaError")));
    setFactorId(enrollment.id);
    setQr(enrollment.totp.qr_code);
    setPhase("enroll");
  }

  useEffect(() => {
    if (initialPhase !== "mfa") return;
    const handle = window.setTimeout(() => void prepareMfa(), 0);
    return () => window.clearTimeout(handle);
  // The initial phase is immutable for the lifetime of this screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const supabase = browserSupabase(authConfig);
    if (!supabase) { setBusy(false); return setMessage(String(t("admin.loginError"))); }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || data.user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      setBusy(false);
      return setMessage(String(t("admin.loginError")));
    }
    await prepareMfa();
    setBusy(false);
  }

  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const supabase = browserSupabase(authConfig);
    if (!supabase || !factorId) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    location.href = "/admin";
  }

  async function requestPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const supabase = browserSupabase(authConfig);
    if (!supabase) { setBusy(false); return setMessage(String(t("admin.loginError"))); }
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent("/admin/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) return setMessage(String(t("admin.recoveryError")));
    setPhase("recover_sent");
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const supabase = browserSupabase(authConfig);
    if (!supabase) { setBusy(false); return setMessage(String(t("admin.recoveryError"))); }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setBusy(false); return setMessage(String(t("admin.recoveryError"))); }
    await supabase.auth.signOut();
    setBusy(false);
    setPhase("reset_done");
  }

  return <main className="admin-auth-page"><section className="admin-auth-card">
    <span className="eyebrow">{t("admin.loginEyebrow")}</span>
    {phase === "login" && <>
      <h1>{t("admin.loginTitle")}</h1><p>{t("admin.loginBody")}</p>
      <form onSubmit={signIn}>
        <label htmlFor="admin-email">{t("account.email")}</label>
        <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="admin-password">{t("admin.password")}</label>
        <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="button button-primary button-full" disabled={busy}>{t("admin.loginSubmit")}</button>
      </form>
      <Link className="text-button" href="/admin/recover">{t("admin.forgotPassword")}</Link>
    </>}
    {(phase === "enroll" || phase === "verify") && <>
      <h1>{t("admin.mfaTitle")}</h1><p>{t("admin.mfaBody")}</p>
      {qr && <Image className="mfa-qr" src={qr} alt={String(t("admin.mfaQrAlt"))} width={224} height={224} unoptimized />}
      <form onSubmit={verifyMfa}>
        <label htmlFor="admin-mfa">{t("admin.mfaCode")}</label>
        <input id="admin-mfa" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
        <button className="button button-primary button-full" disabled={busy}>{t("admin.mfaVerify")}</button>
      </form>
    </>}
    {phase === "recover" && <>
      <h1>{t("admin.recoveryTitle")}</h1><p>{t("admin.recoveryBody")}</p>
      <form onSubmit={requestPasswordReset}>
        <label htmlFor="recovery-email">{t("account.email")}</label>
        <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <button className="button button-primary button-full" disabled={busy}>{t("admin.recoverySubmit")}</button>
      </form>
      <Link className="text-button" href="/admin/login">{t("admin.backToLogin")}</Link>
    </>}
    {phase === "recover_sent" && <><h1>{t("admin.recoverySentTitle")}</h1><p>{t("admin.recoverySent")}</p><Link className="button button-primary button-full" href="/admin/login">{t("admin.backToLogin")}</Link></>}
    {phase === "reset" && <>
      <h1>{t("admin.resetTitle")}</h1><p>{t("admin.resetBody")}</p>
      <form onSubmit={updatePassword}>
        <label htmlFor="reset-password">{t("admin.newPassword")}</label>
        <input id="reset-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="button button-primary button-full" disabled={busy}>{t("admin.resetSubmit")}</button>
      </form>
    </>}
    {phase === "reset_done" && <><h1>{t("admin.resetSuccessTitle")}</h1><p>{t("admin.resetSuccess")}</p><Link className="button button-primary button-full" href="/admin/login">{t("admin.loginSubmit")}</Link></>}
    {message && <p className="error-message" role="alert">{message}</p>}
  </section></main>;
}

export function AdminAuth({ bootstrap, phase, authConfig }: {
  bootstrap: StoreBootstrap;
  phase: "login" | "mfa" | "recover" | "reset";
  authConfig: SupabasePublicConfig;
}) {
  return <StoreI18nProvider locale={bootstrap.locale.code} translations={bootstrap.translations}>
    <AdminAuthForm bootstrap={bootstrap} initialPhase={phase} authConfig={authConfig} />
  </StoreI18nProvider>;
}
