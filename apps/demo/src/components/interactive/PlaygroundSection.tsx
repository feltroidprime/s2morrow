"use client"

import dynamic from "next/dynamic"

const VerificationPlaygroundDynamic = dynamic(
  () =>
    import("./VerificationPlayground").then((m) => m.VerificationPlayground),
  {
    ssr: false,
    loading: () => (
      <section id="verify" className="px-8 py-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
            Verification Playground
          </h2>
          <div className="mt-10 h-48 skeleton-shimmer" />
        </div>
      </section>
    ),
  },
)

export function PlaygroundSection() {
  return <VerificationPlaygroundDynamic />
}
