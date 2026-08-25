"use client";

import { useEffect, useState } from "react";
import { useStore } from "./store-context";

type Consent = { necessary: true; analytics: boolean; marketing: boolean; updatedAt: string };

export function CookieConsent() {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => {
    const handle = window.setTimeout(() => setOpen(!localStorage.getItem("exposprint_consent_v1")), 0);
    return () => window.clearTimeout(handle);
  }, []);
  if (!open) return null;
  const save = (value: Consent) => { localStorage.setItem("exposprint_consent_v1", JSON.stringify(value)); setOpen(false); };
  return <section className="consent" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <span className="eyebrow">ExposPrint</span><h2 id="consent-title">{t("cookies.title")}</h2><p>{t("cookies.body")}</p>
    <div className="consent-options">
      <label><input type="checkbox" checked disabled />{t("cookies.necessary")}</label>
      <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />{t("cookies.analytics")}</label>
      <label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />{t("cookies.marketing")}</label>
    </div>
    <div className="consent-actions"><button className="button" onClick={() => save({ necessary: true, analytics: false, marketing: false, updatedAt: new Date().toISOString() })}>{t("cookies.necessaryOnly")}</button><button className="button button-primary" onClick={() => save({ necessary: true, analytics, marketing, updatedAt: new Date().toISOString() })}>{t("cookies.save")}</button></div>
  </section>;
}
