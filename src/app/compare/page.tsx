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

export default function ComparePage() {
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

  const stores = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      for (const storeName of Object.keys(row.prices_by_store ?? {})) {
        if (storeName) {
          set.add(storeName);
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <main className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Price comparison</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Products are rows. Stores are columns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Back
            </Link>
            <Link
              href="/plan"
              className="rounded-md bg-foreground px-3 py-2 text-sm text-background"
            >
              Continue
            </Link>
          </div>
        </div>

        {listL1.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">
            Your list L1 is empty. Go back and add products first.
          </p>
        ) : (
          <section className="mt-8 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            {loading && (
              <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
                Loading prices…
              </div>
            )}
            {!loading && apiError && (
              <div className="border-b border-zinc-200 px-4 py-3 text-sm text-red-600 dark:border-zinc-800 dark:text-red-400">
                {apiError}
              </div>
            )}

            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 font-medium">Product</th>
                  {stores.map((store) => (
                    <th key={store} className="px-4 py-3 font-medium">
                      {store}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
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
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {row.packaging_format}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {(() => {
                      const numericByStore = new Map<string, number>();
                      for (const store of stores) {
                        const cell = row.prices_by_store?.[store];
                        const priceNumber = parsePrice(cell?.price);
                        if (priceNumber !== null) {
                          numericByStore.set(store, priceNumber);
                        }
                      }

                      const values = Array.from(numericByStore.values());
                      const min = values.length ? Math.min(...values) : null;
                      const max = values.length ? Math.max(...values) : null;
                      const highlightWorst = min !== null && max !== null && min !== max;

                      return stores.map((store) => {
                        const cell = row.prices_by_store?.[store];
                        const priceNumber = numericByStore.get(store);
                        const isBest = min !== null && priceNumber === min;
                        const isWorst = highlightWorst && max !== null && priceNumber === max;

                        const className = [
                          "px-4 py-3",
                          isBest ? "font-medium text-green-700 dark:text-green-400" : "",
                          isWorst ? "font-medium text-red-700 dark:text-red-400" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <td key={store} className={className}>
                            {cell?.price ?? "—"}
                          </td>
                        );
                      });
                    })()}
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
