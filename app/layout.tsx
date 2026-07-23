import type { Metadata } from "next";
import {
  Inter,
  Lora,
  Manrope,
  Outfit,
  Playfair_Display,
  Poppins,
  Syne,
} from "next/font/google";
import Providers from "@/app/providers";
import "./globals.css";

/* Atlas product UI fonts */
const atlasSans = Outfit({
  variable: "--font-atlas-sans",
  subsets: ["latin"],
});

const atlasDisplay = Syne({
  variable: "--font-atlas-display",
  subsets: ["latin"],
});

/* Customer site design-studio fonts */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas — Build a Professional Website in Minutes",
  description:
    "Create beautiful websites with AI. No coding required. Atlas helps small businesses launch and manage professional sites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${atlasSans.variable} ${atlasDisplay.variable} ${inter.variable} ${poppins.variable} ${manrope.variable} ${playfair.variable} ${lora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
