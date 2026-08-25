"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { QuoteLineInput, StoreBootstrap, StoreProduct } from "@/lib/store/types";
import { buildQuote } from "@/lib/store/quote";

export type CartItem = QuoteLineInput & { addedAt: number; artwork?: { name: string; size: number; path?: string; cartSession?: string } };

type StoreContextValue = {
  bootstrap: StoreBootstrap;
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: StoreProduct, quantity: number, configuration: Record<string, string | string[]>, artwork?: CartItem["artwork"]) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  quote: ReturnType<typeof buildQuote> | null;
  t: (key: string) => string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ bootstrap, children }: { bootstrap: StoreBootstrap; children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

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
  const quote = useMemo(() => {
    if (!cart.length) return null;
    try { return buildQuote(bootstrap, cart); } catch { return null; }
  }, [bootstrap, cart]);
  const t = useCallback((key: string) => bootstrap.translations[key] ?? key, [bootstrap.translations]);
  const value = useMemo(() => ({ bootstrap, cart, cartOpen, setCartOpen, addToCart, removeFromCart, clearCart, quote, t }), [bootstrap, cart, cartOpen, addToCart, removeFromCart, clearCart, quote, t]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("StoreProvider is missing");
  return context;
}
