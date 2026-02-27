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
          <div className="mt-10 space-y-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 skeleton-shimmer rounded-2xl" />
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
