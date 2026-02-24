"use client"

import dynamic from "next/dynamic"

const AccountDeployFlowDynamic = dynamic(
  () => import("./AccountDeployFlow").then((module) => module.AccountDeployFlow),
  {
    ssr: false,
    loading: () => (
      <section id="deploy" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight text-falcon-text">Account Deploy Flow</h2>
          <div className="mt-8 h-64 animate-pulse rounded-xl bg-falcon-surface" />
        </div>
      </section>
    ),
  },
)

export function AccountDeploySection(): React.JSX.Element {
  return <AccountDeployFlowDynamic />
}
