"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { QuoteLineInput, StoreBootstrap, StoreProduct, StoreQuote } from "@/lib/store/types";
import { buildQuote } from "@/lib/store/quote";
import { StoreI18nProvider } from "./i18n-provider";

export type CartItem = QuoteLineInput & { addedAt: number; artwork?: { name: string; size: number; path?: string; cartSession?: string } };

type StoreContextValue = {
  bootstrap: StoreBootstrap;
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: StoreProduct, quantity: number, configuration: Record<string, string | string[]>, artwork?: CartItem["artwork"]) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  quote: StoreQuote | null;
  destinationCountry: string;
  setDestinationCountry: (country: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function StoreStateProvider({ bootstrap, children }: { bootstrap: StoreBootstrap; children: React.ReactNode }) {
  const { t: translate } = useTranslation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [destinationCountry, setDestinationCountry] = useState(bootstrap.destinationCountry ?? bootstrap.market.countryCode);
  const [serverQuote, setServerQuote] = useState<StoreQuote | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("exposprint_cart_v1");
        if (saved) setCart(JSON.parse(saved) as CartItem[]);
      } catch {
        localStorage.removeItem("exposprint_cart_v1");
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    localStorage.setItem("exposprint_cart_v1", JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((product: StoreProduct, quantity: number, configuration: Record<string, string | string[]>, artwork?: CartItem["artwork"]) => {
    setCart((current) => [...current, { productId: product.id, quantity, configuration, artwork, addedAt: Date.now() }]);
    setCartOpen(true);
  }, []);
  const removeFromCart = useCallback((index: number) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const localQuote = useMemo(() => {
    if (!cart.length) return null;
    try { return buildQuote(bootstrap, cart); } catch { return null; }
  }, [bootstrap, cart]);

  useEffect(() => {
    if (!cart.length) {
      const clear = window.setTimeout(() => setServerQuote(null), 0);
      return () => window.clearTimeout(clear);
    }
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            destinationCountry,
            items: cart.map(({ productId, quantity, configuration }) => ({ productId, quantity, configuration })),
          }),
          signal: controller.signal,
        });
        if (response.ok) setServerQuote(await response.json() as StoreQuote);
      } catch {
        if (!controller.signal.aborted) setServerQuote(null);
      }
    }, 120);
    return () => { window.clearTimeout(handle); controller.abort(); };
  }, [cart, destinationCountry]);

  const quote = serverQuote ?? localQuote;
  const t = useCallback((key: string, options?: Record<string, unknown>) => String(translate(key, options)), [translate]);
  const value = useMemo(() => ({ bootstrap, cart, cartOpen, setCartOpen, addToCart, removeFromCart, clearCart, quote, destinationCountry, setDestinationCountry, t }), [bootstrap, cart, cartOpen, addToCart, removeFromCart, clearCart, quote, destinationCountry, t]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ bootstrap, children }: { bootstrap: StoreBootstrap; children: React.ReactNode }) {
  return <StoreI18nProvider locale={bootstrap.locale.code} translations={bootstrap.translations}>
    <StoreStateProvider bootstrap={bootstrap}>{children}</StoreStateProvider>
  </StoreI18nProvider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("StoreProvider is missing");
  return context;
}
