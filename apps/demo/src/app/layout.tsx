import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import Providers from "./providers"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Falcon-512 | Post-Quantum Signatures on Starknet",
  description:
    "Demo of Falcon-512 post-quantum signature verification for Starknet account abstraction. 63K steps, 62 calldata felts.",
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-falcon-bg text-falcon-text antialiased font-[family-name:var(--font-inter)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
