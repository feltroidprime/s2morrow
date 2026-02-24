"use client"

/**
 * Client-side wrapper for VerificationPlayground with next/dynamic.
 *
 * `ssr: false` is required to prevent WASM from running during SSR, and must
 * be used inside a Client Component — Next.js 15 enforces this. This thin
 * wrapper satisfies that requirement while keeping page.tsx as a RSC.
 */

import dynamic from "next/dynamic"

const VerificationPlaygroundDynamic = dynamic(
  () =>
    import("./VerificationPlayground").then((m) => m.VerificationPlayground),
  {
    ssr: false,
    loading: () => (
      <section id="verify" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Verification Playground
          </h2>
          <div className="mt-8 h-48 rounded-xl bg-falcon-surface animate-pulse" />
        </div>
      </section>
    ),
  },
)

export function PlaygroundSection() {
  return <VerificationPlaygroundDynamic />
}
