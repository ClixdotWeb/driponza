import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, Pinyon_Script } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const pinyon = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-pinyon", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Driponza — Pure Spices. Bold Flavour.", template: "%s · Driponza" },
  description:
    "Discover carefully selected whole spices from Driponza — cardamom, cloves, cassia cinnamon, mace, nutmeg, star anise, bay leaf and black pepper. Naturally selected, carefully packed.",
  openGraph: { type: "website", siteName: "Driponza", images: ["/brand/story.jpg"] },
};

export const viewport: Viewport = { themeColor: "#123d22", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${instrument.variable} ${inter.variable} ${pinyon.variable}`}>
      <head>
        {/* Marks JS as available before paint (see data-animate in globals.css). Failsafe reveals content if hydration stalls. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');setTimeout(function(){document.documentElement.classList.remove('js')},1800)",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
