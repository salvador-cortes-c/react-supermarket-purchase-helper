"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StoredProduct = {
  id: string;
  name: string;
  packagingFormat?: string;
  thumbnail: string;
};

type ApiStorePrice = {
  price: string;
  unit_price?: string | null;
  source_url?: string | null;
  scraped_at?: string | null;
};

type ApiCompareRow = {
  product_key: string;
  name: string;
  packaging_format?: string | null;
  image?: string | null;
  prices_by_store: Record<string, ApiStorePrice>;
};

type PlanRow = {
  product_key: string;
  name: string;
  packaging_format?: string | null;
  image?: string | null;
  bestPriceText: string | null;
  bestPriceNumber: number | null;
  supermarkets: string[];
};

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_PRODUCTS_API_BASE ?? "http://localhost:8000";
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return null;
  }
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export default function PlanPage() {
  const [listL1, setListL1] = useState<StoredProduct[]>([]);
  const [rows, setRows] = useState<ApiCompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("listL1");
      const parsed = raw ? (JSON.parse(raw) as StoredProduct[]) : [];
      if (!Array.isArray(parsed)) {
        setListL1([]);
        return;
      }
      const restored = parsed
        .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
        .map((item) => ({
          id: item.id,
          name: item.name,
          packagingFormat: item.packagingFormat,
          thumbnail: item.thumbnail ?? "/file.svg",
        }));
      setListL1(restored);
    } catch {
      setListL1([]);
    }
  }, []);

  useEffect(() => {
    const keys = listL1.map((p) => p.id).filter(Boolean);
    if (keys.length === 0) {
      setRows([]);
      setApiError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const url = new URL("/products/compare", apiBaseUrl());
        for (const k of keys) {
          url.searchParams.append("key", k);
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          setRows([]);
          setApiError(`API error: ${response.status}`);
          setLoading(false);
          return;
        }

        const data = (await response.json()) as ApiCompareRow[];
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setRows([]);
        setApiError("Cannot reach Products API (http://localhost:8000)");
        setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [listL1]);

  const planRows = useMemo((): PlanRow[] => {
    return rows.map((row) => {
      let best: number | null = null;
      const supermarkets: string[] = [];

      for (const [store, cell] of Object.entries(row.prices_by_store ?? {})) {
        const priceNumber = parsePrice(cell?.price);
        if (priceNumber === null) {
          continue;
        }
        if (best === null || priceNumber < best) {
          best = priceNumber;
        }
      }

      if (best !== null) {
        for (const [store, cell] of Object.entries(row.prices_by_store ?? {})) {
          const priceNumber = parsePrice(cell?.price);
          if (priceNumber === best) {
            supermarkets.push(store);
          }
        }
      }

      supermarkets.sort((a, b) => a.localeCompare(b));

      const bestPriceText = best !== null ? best.toFixed(2) : null;

      return {
        product_key: row.product_key,
        name: row.name,
        packaging_format: row.packaging_format,
        image: row.image,
        bestPriceText,
        bestPriceNumber: best,
        supermarkets,
      };
    });
  }, [rows]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <main className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plan</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              For each product, pick the best price. If multiple supermarkets tie, list them all.
            </p>
          </div>
          <Link
            href="/compare"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>

        {listL1.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">Your list L1 is empty. Go back and add products first.</p>
        ) : (
          <section className="mt-8 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            {loading && (
              <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
                Loading…
              </div>
            )}
            {!loading && apiError && (
              <div className="border-b border-zinc-200 px-4 py-3 text-sm text-red-600 dark:border-zinc-800 dark:text-red-400">
                {apiError}
              </div>
            )}

            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Best price</th>
                  <th className="px-4 py-3 font-medium">Supermarket(s)</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((row) => (
                  <tr key={row.product_key} className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Image
                          src={row.image ?? "/file.svg"}
                          alt={`${row.name} thumbnail`}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <div>
                          <div className="font-medium">{row.name}</div>
                          {row.packaging_format ? (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">{row.packaging_format}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.bestPriceText ?? "—"}</td>
                    <td className="px-4 py-3">{row.supermarkets.length ? row.supermarkets.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
