"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  packagingFormat?: string;
  thumbnail: string;
};

type ApiProduct = {
  product_key?: string | null;
  name: string;
  packaging_format?: string | null;
  image?: string | null;
};

function toId(product: { name: string; packagingFormat?: string; productKey?: string }): string {
  if (product.productKey) {
    return product.productKey.toLowerCase();
  }
  const suffix = product.packagingFormat ?? "";
  return `${product.name}__${suffix}`.toLowerCase();
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_PRODUCTS_API_BASE ?? "http://localhost:8000";
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [listL1, setListL1] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const lastRequestRef = useRef(0);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSuggestions([]);
      setLoading(false);
      setApiError(null);
      return;
    }

    const requestId = Date.now();
    lastRequestRef.current = requestId;

    setLoading(true);
    setApiError(null);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const url = new URL("/products/search", apiBaseUrl());
        url.searchParams.set("q", query);
        url.searchParams.set("limit", "8");

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          if (lastRequestRef.current === requestId) {
            setSuggestions([]);
            setApiError(`API error: ${response.status}`);
            setLoading(false);
          }
          return;
        }

        const data = (await response.json()) as ApiProduct[];
        const mapped: Product[] = data
          .map((item) => {
            const product: Product = {
              id: toId({
                name: item.name,
                packagingFormat: item.packaging_format ?? undefined,
                productKey: item.product_key ?? undefined,
              }),
              name: item.name,
              packagingFormat: item.packaging_format ?? undefined,
              thumbnail: item.image ?? "/file.svg",
            };
            return product;
          })
          .filter((product) => !listL1.some((item) => item.id === product.id));

        if (lastRequestRef.current === requestId) {
          setSuggestions(mapped);
          setLoading(false);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (lastRequestRef.current === requestId) {
          setSuggestions([]);
          setApiError("Cannot reach Products API (http://localhost:8000)");
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, listL1]);

  const addProduct = (product: Product) => {
    setListL1((current) => {
      if (current.some((item) => item.id === product.id)) {
        return current;
      }

      return [...current, product];
    });
    setSearch("");
    setSuggestions([]);
  };

  const removeProduct = (id: string) => {
    setListL1((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <main className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Smart Supermarket List
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Search products and build list L1. In the next screen, we will compare
          supermarkets and evaluate split lists.
        </p>

        <section className="mt-8">
          <label htmlFor="product-search" className="text-sm font-medium">
            Search product
          </label>
          <div className="relative mt-2">
            <input
              id="product-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type a product name..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              autoComplete="off"
            />

            {search.trim().length > 0 && (suggestions.length > 0 || loading || apiError) && (
              <ul className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                {loading && (
                  <li className="px-3 py-2 text-sm text-zinc-500">
                    Loading…
                  </li>
                )}

                {!loading && apiError && (
                  <li className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                    {apiError}
                  </li>
                )}

                {!loading && !apiError && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-sm text-zinc-500">
                    No results.
                  </li>
                )}

                {suggestions.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={product.thumbnail}
                          alt={`${product.name} thumbnail`}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <span>{product.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {product.packagingFormat ?? ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">List L1</h2>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {listL1.length} products
            </span>
          </div>

          {listL1.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No products yet. Use the search box to add items.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {listL1.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={product.thumbnail}
                      alt={`${product.name} thumbnail`}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-zinc-500">
                        {product.packagingFormat ?? ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8">
          <button
            type="button"
            disabled={listL1.length === 0}
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to price comparison
          </button>
        </div>
      </main>
    </div>
  );
}
