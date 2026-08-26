import type { Metadata } from "next";
import { Manrope, Oswald } from "next/font/google";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { createTranslator } from "@/lib/i18n/config";
import "./globals.css";

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin"] });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const bootstrap = await getStoreBootstrap({ visitorCountry: await getVisitorCountry() });
  const t = await createTranslator(bootstrap.locale.code, bootstrap.translations);
  const title = t("meta.title");
  const description = t("meta.description");
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://exposprint-shop.mmgrafisk.chatgpt.site"),
    title: { default: title, template: t("meta.titleTemplate") },
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, images: ["/og.png"] },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const bootstrap = await getStoreBootstrap({ visitorCountry: await getVisitorCountry() });
  return <html lang={bootstrap.locale.code}><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
