"use client"

import React from "react"
import { KeyManagementPanel } from "./KeyManagementPanel"
import { SignVerifyPanel } from "./SignVerifyPanel"

export function VerificationPlayground(): React.JSX.Element {
  return (
    <section id="verify" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Verification Playground
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/40">
          Generate a Falcon-512 keypair in-browser via WASM, sign a message,
          and verify the signature. All crypto runs locally.
        </p>

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
