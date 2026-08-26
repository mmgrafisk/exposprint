"use client";

import { useMemo, useState } from "react";
import { FileCheck2, ShoppingBag, UploadCloud } from "lucide-react";
import {
  customerUnitPrice,
  deliveryEstimate,
  formatMoney,
} from "@/lib/store/pricing";
import type { StoreProduct } from "@/lib/store/types";
import { useStore } from "./store-context";

export function ProductConfigurator({ product }: { product: StoreProduct }) {
  const { bootstrap, addToCart, t } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [configuration, setConfiguration] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        product.options
          .filter((option) => option.values.length)
          .map((option) => [option.code, option.values[0]]),
      ),
  );
  const [artwork, setArtwork] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "ready" | "uploading" | "uploaded" | "deferred"
  >("idle");
  const [progress, setProgress] = useState(0);
  const zone =
    bootstrap.shippingZones.find(
      (item) => item.code === bootstrap.market.shippingZone,
    ) ?? bootstrap.shippingZones[0];
  const delivery = deliveryEstimate(product, zone);
  const unitPrice = customerUnitPrice(
    product,
    bootstrap.market,
    bootstrap.currency,
    bootstrap.settings.grossMarginPercent,
  ).gross;
  const total = useMemo(
    () => ({ ...unitPrice, amountMinor: unitPrice.amountMinor * quantity }),
    [unitPrice, quantity],
  );

  async function uploadFile(file: File) {
    setUploadState("uploading");
    const cartSession = crypto.randomUUID();
    const response = await fetch("/api/artwork/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        size: file.size,
        mime: file.type,
        cartSession,
      }),
    });
    if (!response.ok) {
      setUploadState("deferred");
      return undefined;
    }
    const authorization = (await response.json()) as {
      path: string;
      token: string;
      endpoint: string;
      cartSession: string;
    };
    try {
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: authorization.endpoint,
          headers: { "x-signature": authorization.token },
          retryDelays: [0, 3000, 5000, 10000],
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: 6 * 1024 * 1024,
          metadata: {
            bucketName: "artwork-private",
            objectName: authorization.path,
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
          },
          onProgress: (sent, totalBytes) =>
            setProgress(Math.round((sent / totalBytes) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload
          .findPreviousUploads()
          .then((previous) => {
            if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
            upload.start();
          })
          .catch(reject);
      });
      setUploadState("uploaded");
      return {
        path: authorization.path,
        cartSession: authorization.cartSession,
      };
    } catch {
      setUploadState("deferred");
      return undefined;
    }
  }

  async function add() {
    const authorization = artwork ? await uploadFile(artwork) : undefined;
    addToCart(
      product,
      quantity,
      configuration,
      artwork
        ? { name: artwork.name, size: artwork.size, ...authorization }
        : undefined,
    );
  }

  return (
    <section className="configurator">
      <span className="eyebrow">{t("product.configure")}</span>
      <div className="configurator-options">
        {product.options.map((option) => (
          <label key={option.code}>
            <span>{option.label}</span>
            {option.values.length ? (
              <select
                value={configuration[option.code] ?? ""}
                required={option.required}
                onChange={(event) =>
                  setConfiguration((current) => ({
                    ...current,
                    [option.code]: event.target.value,
                  }))
                }
              >
                {option.values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required={option.required}
                value={configuration[option.code] ?? ""}
                onChange={(event) =>
                  setConfiguration((current) => ({
                    ...current,
                    [option.code]: event.target.value,
                  }))
                }
              />
            )}
          </label>
        ))}
      </div>
      <label className="quantity-field">
        <span>{t("product.quantity")}</span>
        <input
          type="number"
          min={1}
          max={100}
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Math.max(1, Math.min(100, Number(event.target.value) || 1)),
            )
          }
        />
      </label>
      <label className="artwork-drop">
        <input
          type="file"
          accept=".pdf,.ai,.eps,.svg,application/pdf,application/postscript,image/svg+xml"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setArtwork(selected);
            setUploadState(selected ? "ready" : "idle");
          }}
        />
        <UploadCloud aria-hidden />
        <strong>{t("product.upload")}</strong>
        {artwork && (
          <span>
            {t("product.fileSizeMb", { size: (artwork.size / 1024 / 1024).toFixed(1) })}
          </span>
        )}
      </label>
      {uploadState !== "idle" && (
        <div className="upload-status">
          <FileCheck2 size={17} />
          <span>
            {uploadState === "ready"
              ? t("product.uploadReady")
              : uploadState === "uploading"
                ? `${t("product.uploading")} ${progress}%`
                : uploadState === "uploaded"
                  ? t("product.uploaded")
                  : t("product.uploadUnavailable")}
          </span>
        </div>
      )}
      <div className="configurator-delivery">
        <span>
          {t("catalog.production")}:{" "}
          <strong>
            {delivery.productionDaysMin}–{delivery.productionDaysMax}{" "}
            {t("catalog.businessDays")}
          </strong>
        </span>
        <span>
          {t("catalog.delivery")}:{" "}
          <strong>
            {delivery.totalDaysMin}–{delivery.totalDaysMax}{" "}
            {t("catalog.businessDays")}
          </strong>
        </span>
        <span>
          {t("cart.shipping")}: <strong>{t("cart.free")}</strong>
        </span>
      </div>
      <div className="configurator-total">
        <div>
          <span>{t("product.price")}</span>
          <strong>
            {formatMoney(
              total,
              bootstrap.locale.intlLocale,
              bootstrap.currency.decimals,
            )}
          </strong>
        </div>
        <button
          className="button button-primary"
          onClick={add}
          disabled={uploadState === "uploading"}
        >
          <ShoppingBag size={18} />
          {t("product.add")}
        </button>
      </div>
    </section>
  );
}
