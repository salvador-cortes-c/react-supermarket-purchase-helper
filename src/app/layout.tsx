import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "React Supermarket Purchase Helper",
  description: "Search products, build a list, and compare supermarket prices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
