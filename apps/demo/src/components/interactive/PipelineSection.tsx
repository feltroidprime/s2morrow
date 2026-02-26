"use client"

import dynamic from "next/dynamic"

const PipelineVisualizerDynamic = dynamic(
  () =>
    import("./PipelineVisualizer").then((m) => m.PipelineVisualizer),
  {
    ssr: false,
    loading: () => (
      <section id="pipeline" className="px-8 py-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
            What happens on-chain
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-32 skeleton-shimmer rounded-3xl" />
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
