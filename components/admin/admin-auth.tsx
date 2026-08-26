"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useTranslation } from "react-i18next";
import { StoreI18nProvider } from "@/components/store/i18n-provider";
import type { StoreBootstrap } from "@/lib/store/types";

type Phase = "login" | "enroll" | "verify" | "setup" | "setup_done";

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

function AdminAuthForm({ bootstrap, initialPhase }: { bootstrap: StoreBootstrap; initialPhase: "login" | "mfa" | "setup" }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>(initialPhase === "mfa" ? "verify" : initialPhase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function prepareMfa() {
    const supabase = browserSupabase();
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
    const supabase = browserSupabase();
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
    const supabase = browserSupabase();
    if (!supabase || !factorId) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) { setBusy(false); return setMessage(String(t("admin.mfaError"))); }
    location.href = "/admin";
  }

  async function setup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, token }),
    });
    setBusy(false);
    if (response.status === 202) return setMessage(String(t("admin.setupConfirmEmail")));
    if (!response.ok) return setMessage(String(t("admin.setupError")));
    setPhase("setup_done");
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
      <Link className="text-button" href="/admin/setup">{t("admin.setupLink")}</Link>
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
    {phase === "setup" && <>
      <h1>{t("admin.setupTitle")}</h1><p>{t("admin.setupBody")}</p>
      <form onSubmit={setup}>
        <label htmlFor="setup-email">{t("account.email")}</label><input id="setup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="setup-password">{t("admin.password")}</label><input id="setup-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <label htmlFor="setup-token">{t("admin.setupToken")}</label><input id="setup-token" type="password" autoComplete="off" required value={token} onChange={(event) => setToken(event.target.value)} />
        <button className="button button-primary button-full" disabled={busy}>{t("admin.setupSubmit")}</button>
      </form>
    </>}
    {phase === "setup_done" && <><h1>{t("admin.setupSuccess")}</h1><Link className="button button-primary button-full" href="/admin/login">{t("admin.loginSubmit")}</Link></>}
    {message && <p className="error-message" role="alert">{message}</p>}
  </section></main>;
}

export function AdminAuth({ bootstrap, phase }: { bootstrap: StoreBootstrap; phase: "login" | "mfa" | "setup" }) {
  return <StoreI18nProvider locale={bootstrap.locale.code} translations={bootstrap.translations}>
    <AdminAuthForm bootstrap={bootstrap} initialPhase={phase} />
  </StoreI18nProvider>;
}
