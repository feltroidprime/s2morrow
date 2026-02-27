"use client"

import React from "react"
import { KeyManagementPanel } from "./KeyManagementPanel"
import { SignVerifyPanel } from "./SignVerifyPanel"

export function VerificationPlayground(): React.JSX.Element {
  return (
    <section id="verify" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Try it yourself
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/70">
          Generate a Falcon-512 keypair, sign any message, and verify &mdash;
          all running locally in your browser via WebAssembly.
        </p>

        {/* Step guide */}
        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-2 rounded-lg bg-falcon-accent/6 px-3 py-1.5 font-medium text-falcon-accent/70 border border-falcon-accent/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-falcon-accent/15 text-[10px] font-bold text-falcon-accent">1</span>
            Generate a keypair
          </span>
          <span className="text-falcon-text/30">&rarr;</span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-falcon-accent/6 px-3 py-1.5 font-medium text-falcon-accent/70 border border-falcon-accent/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-falcon-accent/15 text-[10px] font-bold text-falcon-accent">2</span>
            Type a message &amp; sign
          </span>
          <span className="text-falcon-text/30">&rarr;</span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-falcon-accent/6 px-3 py-1.5 font-medium text-falcon-accent/70 border border-falcon-accent/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-falcon-accent/15 text-[10px] font-bold text-falcon-accent">3</span>
            Verified in-browser
          </span>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="glass-card-static rounded-2xl p-8">
            <KeyManagementPanel />
          </div>
          <div className="glass-card-static rounded-2xl p-8">
            <SignVerifyPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
