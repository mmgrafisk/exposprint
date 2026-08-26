"use client";

import { useState } from "react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { i18nOptions } from "@/lib/i18n/config";
import type { TranslationBundle } from "@/lib/store/types";

export function StoreI18nProvider({
  locale,
  translations,
  children,
}: {
  locale: string;
  translations: TranslationBundle;
  children: React.ReactNode;
}) {
  const [instance] = useState(() => {
    const next = createInstance();
    void next.init(i18nOptions(locale, translations));
    return next;
  });
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
