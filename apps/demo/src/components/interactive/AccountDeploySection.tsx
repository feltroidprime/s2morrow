"use client"

import dynamic from "next/dynamic"

const AccountDeployFlowDynamic = dynamic(
  () => import("./AccountDeployFlow").then((module) => module.AccountDeployFlow),
  {
    ssr: false,
    loading: () => (
      <section id="deploy" className="px-8 py-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Account Deploy Flow</h2>
          <div className="mt-10 h-64 skeleton-shimmer rounded-2xl" />
        </div>
      </section>
    ),
  },
)

export function AccountDeploySection(): React.JSX.Element {
  return <AccountDeployFlowDynamic />
}
