import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/store/site-shell";
import { ProductConfigurator } from "@/components/store/product-configurator";
import { getProductBySlug } from "@/lib/store/data";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const cookieStore = await cookies();
  const { bootstrap, product } = await getProductBySlug(locale, slug, cookieStore.get("ep_currency")?.value, cookieStore.get("ep_market")?.value);
  if (bootstrap.locale.code !== locale || !product) notFound();
  const t = (key: string) => bootstrap.translations[key] ?? key;
  return <SiteShell bootstrap={bootstrap}><main className="product-page"><div className="shell"><Link className="back-link" href={`/${locale}#products`}><ArrowLeft size={16} />{t("product.back")}</Link><div className="product-detail-grid"><div className="product-gallery">{product.approvedImage && <Image src={product.approvedImage} alt={product.title} width={1200} height={1200} priority unoptimized />}</div><div className="product-information"><span className="card-category">{product.category}</span><h1>{product.title}</h1><p>{product.description}</p><ProductConfigurator product={product} /></div></div></div></main></SiteShell>;
}
