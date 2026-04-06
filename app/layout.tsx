import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Kikuu — Shop Ghana",
    template: "%s | Kikuu",
  },
  description:
    "Shop the best products delivered across Ghana. Electronics, fashion, home goods and more.",
  keywords: ["ghana", "online shopping", "ecommerce", "accra", "kumasi"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${dmSans.variable} font-sans min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
