"use client"

/**
 * Client-side wrapper for PipelineVisualizer with next/dynamic.
 *
 * Mirrors PlaygroundSection pattern: `ssr: false` prevents atom
 * hydration mismatch while keeping page.tsx as a RSC.
 */

import dynamic from "next/dynamic"

const PipelineVisualizerDynamic = dynamic(
  () =>
    import("./PipelineVisualizer").then((m) => m.PipelineVisualizer),
  {
    ssr: false,
    loading: () => (
      <section id="pipeline" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Verification Pipeline
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-32 rounded-xl bg-falcon-surface animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    ),
  },
)

export function PipelineSection() {
  return <PipelineVisualizerDynamic />
}
