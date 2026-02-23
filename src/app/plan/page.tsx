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

type GroupedItem = {
  product_key: string;
  name: string;
  packaging_format?: string | null;
  image?: string | null;
  store: string;
  priceText: string | null;
  priceNumber: number | null;
};

type StoreGroup = {
  store: string;
  items: GroupedItem[];
};

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

  const cheapestGroups = useMemo((): StoreGroup[] => {
    const byStore = new Map<string, GroupedItem[]>();

    for (const row of rows) {
      let bestStore: string | null = null;
      let bestPrice: number | null = null;
      let bestPriceText: string | null = null;

      for (const store of Object.keys(row.prices_by_store ?? {})) {
        const cell = row.prices_by_store?.[store];
        const priceNumber = parsePrice(cell?.price);
        if (priceNumber === null) {
          continue;
        }

        if (bestPrice === null || priceNumber < bestPrice) {
          bestPrice = priceNumber;
          bestStore = store;
          bestPriceText = cell?.price ?? null;
        }
      }

      if (!bestStore) {
        continue;
      }

      const item: GroupedItem = {
        product_key: row.product_key,
        name: row.name,
        packaging_format: row.packaging_format,
        image: row.image,
        store: bestStore,
        priceText: bestPriceText,
        priceNumber: bestPrice,
      };

      byStore.set(bestStore, [...(byStore.get(bestStore) ?? []), item]);
    }

    return Array.from(byStore.entries())
      .map(([store, items]) => ({ store, items }))
      .sort((a, b) => a.store.localeCompare(b.store));
  }, [rows]);

  const availabilityGroups = useMemo((): StoreGroup[] => {
    // Availability heuristic: rank stores by how many of the selected products they have a price for,
    // then assign each product to the first store in that ranking where it is available.
    const availabilityCount = new Map<string, number>();
    for (const store of stores) {
      availabilityCount.set(store, 0);
    }

    for (const row of rows) {
      for (const store of stores) {
        const cell = row.prices_by_store?.[store];
        if (parsePrice(cell?.price) !== null) {
          availabilityCount.set(store, (availabilityCount.get(store) ?? 0) + 1);
        }
      }
    }

    const rankedStores = [...stores].sort((a, b) => {
      const diff = (availabilityCount.get(b) ?? 0) - (availabilityCount.get(a) ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    const byStore = new Map<string, GroupedItem[]>();
    for (const store of rankedStores) {
      byStore.set(store, []);
    }

    for (const row of rows) {
      let chosenStore: string | null = null;
      for (const store of rankedStores) {
        const cell = row.prices_by_store?.[store];
        if (parsePrice(cell?.price) !== null) {
          chosenStore = store;
          break;
        }
      }

      if (!chosenStore) {
        continue;
      }

      const cell = row.prices_by_store?.[chosenStore];
      const item: GroupedItem = {
        product_key: row.product_key,
        name: row.name,
        packaging_format: row.packaging_format,
        image: row.image,
        store: chosenStore,
        priceText: cell?.price ?? null,
        priceNumber: parsePrice(cell?.price),
      };

      byStore.set(chosenStore, [...(byStore.get(chosenStore) ?? []), item]);
    }

    return Array.from(byStore.entries())
      .map(([store, items]) => ({ store, items }))
      .filter((group) => group.items.length > 0);
  }, [rows, stores]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <main className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Split lists</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Group products by convenience (cheapest) or availability.
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
          <>
            {loading && (
              <p className="mt-8 text-sm text-zinc-500">Loading…</p>
            )}
            {!loading && apiError && (
              <p className="mt-8 text-sm text-red-600 dark:text-red-400">{apiError}</p>
            )}

            {!loading && !apiError && (
              <>
                <section className="mt-8">
                  <h2 className="text-lg font-medium">1) Prioritise the most convenient price</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Each product is assigned to the store where it has the cheapest available price.
                  </p>

                  {cheapestGroups.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500">No priced products found.</p>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {cheapestGroups.map((group) => (
                        <div key={group.store} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{group.store}</h3>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{group.items.length} items</span>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {group.items.map((item) => (
                              <li key={item.product_key} className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                                <div className="flex items-center gap-3">
                                  <Image
                                    src={item.image ?? "/file.svg"}
                                    alt={`${item.name} thumbnail`}
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                  <div>
                                    <div className="text-sm font-medium">{item.name}</div>
                                    {item.packaging_format ? (
                                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{item.packaging_format}</div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-sm">{item.priceText ?? "—"}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mt-10">
                  <h2 className="text-lg font-medium">2) Prioritise the availability of the product</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Stores are ranked by how many of your products have a price. Each product is assigned to the first store in that ranking where it appears.
                  </p>

                  {availabilityGroups.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500">No priced products found.</p>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {availabilityGroups.map((group) => (
                        <div key={group.store} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{group.store}</h3>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{group.items.length} items</span>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {group.items.map((item) => (
                              <li key={item.product_key} className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                                <div className="flex items-center gap-3">
                                  <Image
                                    src={item.image ?? "/file.svg"}
                                    alt={`${item.name} thumbnail`}
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                  <div>
                                    <div className="text-sm font-medium">{item.name}</div>
                                    {item.packaging_format ? (
                                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{item.packaging_format}</div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-sm">{item.priceText ?? "—"}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
