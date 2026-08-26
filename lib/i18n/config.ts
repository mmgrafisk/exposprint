import { createInstance, type i18n, type TOptions } from "i18next";
import type { TranslationBundle } from "@/lib/store/types";

type Translator = (key: string, options?: TOptions) => string;

export const i18nOptions = (locale: string, translations: TranslationBundle) => ({
  lng: locale,
  fallbackLng: false as const,
  resources: { [locale]: { translation: translations } },
  defaultNS: "translation",
  keySeparator: false as const,
  nsSeparator: false as const,
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  initImmediate: false,
  parseMissingKeyHandler: () => translations["system.missingTranslation"] ?? "",
});

export async function createI18n(locale: string, translations: TranslationBundle): Promise<i18n> {
  const instance = createInstance();
  await instance.init(i18nOptions(locale, translations));
  return instance;
}

export async function createTranslator(locale: string, translations: TranslationBundle): Promise<Translator> {
  const instance = await createI18n(locale, translations);
  return (key, options) => String(instance.t(key, options));
}
