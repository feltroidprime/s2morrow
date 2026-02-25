"use client"

import React from "react"
import { KeyManagementPanel } from "./KeyManagementPanel"
import { SignVerifyPanel } from "./SignVerifyPanel"

export function VerificationPlayground(): React.JSX.Element {
  return (
    <section id="verify" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-falcon-text">
          Verification Playground
        </h2>
        <p className="mt-4 text-falcon-muted">
          Generate a Falcon-512 keypair in-browser via WASM, sign a message,
          and verify the signature. All crypto runs locally — no server
          involvement.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
            <KeyManagementPanel />
          </div>
          <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
            <SignVerifyPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
