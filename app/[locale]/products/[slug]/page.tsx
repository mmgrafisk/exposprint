import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/store/site-shell";
import { ProductConfigurator } from "@/components/store/product-configurator";
import { getProductBySlug } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { createTranslator } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const { bootstrap, product } = await getProductBySlug({ routeLocale: locale, visitorCountry: await getVisitorCountry() }, slug);
  if (bootstrap.locale.code !== locale) redirect(`/${bootstrap.locale.code}/products/${slug}`);
  if (!product) notFound();
  const t = await createTranslator(bootstrap.locale.code, bootstrap.translations);
  return <SiteShell bootstrap={bootstrap}><main className="product-page"><div className="shell"><Link className="back-link" href={`/${locale}#products`}><ArrowLeft size={16} />{t("product.back")}</Link><div className="product-detail-grid"><div className="product-gallery">{product.approvedImage && <Image src={product.approvedImage} alt={product.title} width={1200} height={1200} priority unoptimized />}</div><div className="product-information"><span className="card-category">{product.category}</span><h1>{product.title}</h1><p>{product.description}</p><ProductConfigurator product={product} /></div></div></div></main></SiteShell>;
}
