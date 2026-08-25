"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useStore } from "./store-context";

export function AccountPanel() {
  const { bootstrap, t } = useStore();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return setMessage(t("account.unavailable"));
    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/${bootstrap.locale.code}/account` },
    });
    setMessage(error ? error.message : t("account.sent"));
  }

  return <main className="account-page"><section className="account-card">
    <span className="eyebrow">ExposPrint</span>
    <h1>{t("account.title")}</h1>
    <p>{t("account.body")}</p>
    <form onSubmit={login}>
      <label htmlFor="email">{t("account.email")}</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <button className="button button-primary button-full">{t("account.submit")}</button>
    </form>
    {message && <p aria-live="polite">{message}</p>}
  </section></main>;
}
