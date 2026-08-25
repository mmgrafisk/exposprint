import type { Metadata } from "next";
import { Manrope, Oswald } from "next/font/google";
import "./globals.css";

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const display = Oswald({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://exposprint.openai.site"),
  title: { default: "ExposPrint — Messeudstyr med gennemslagskraft", template: "%s — ExposPrint" },
  description: "Professionelle flag, bannere, telte og messesystemer til hele EU.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "ExposPrint", description: "Gør plads til dit brand.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="da"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
