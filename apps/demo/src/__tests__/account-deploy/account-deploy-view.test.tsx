import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RegistryProvider } from "@effect-atom/atom-react"
import { Option } from "effect"
import { keypairAtom } from "../../atoms/falcon"
import { deployStepAtom } from "../../atoms/starknet"
import { AccountDeployFlow } from "../../components/interactive/AccountDeployFlow"
import { ContractAddress, TxHash } from "../../services/types"
import type { DeployStep } from "../../atoms/starknet"
import type { FalconKeypair } from "../../services/types"

const KEYPAIR: FalconKeypair = {
  secretKey: new Uint8Array(1281).fill(1),
  verifyingKey: new Uint8Array(897).fill(2),
  publicKeyNtt: new Int32Array(512).fill(3),
}

const TX_HASH = TxHash.make(
  "0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d"
)
const ADDRESS = ContractAddress.make(
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
)

const renderAccountDeployFlow = (options?: {
  readonly step?: DeployStep
  readonly keypair?: Option.Option<FalconKeypair>
}): string => {
  const step = options?.step ?? { step: "idle" }
  const keypair = options?.keypair ?? Option.none()

  return renderToStaticMarkup(
    React.createElement(
      RegistryProvider,
      {
        initialValues: [
          [deployStepAtom, step],
          [keypairAtom, keypair],
        ],
      },
      React.createElement(AccountDeployFlow),
    ),
  )
}

describe("AccountDeployFlow view", () => {
  it("renders all five deploy steps", () => {
    const html = renderAccountDeployFlow()
    expect(html).toContain("Generate Keypair")
    expect(html).toContain("Pack Public Key")
    expect(html).toContain("Compute Address")
    expect(html).toContain("Fund Account")
    expect(html).toContain("Deploy")
  })

  it("renders Starkscan link in success state", () => {
    const html = renderAccountDeployFlow({
      step: { step: "deployed", address: ADDRESS, txHash: TX_HASH },
      keypair: Option.some(KEYPAIR),
    })

    expect(html).toContain(`href="https://starkscan.co/tx/${TX_HASH}"`)
    expect(html).toContain("View on Starkscan")
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })

  it("renders Try Again action and alert semantics in error state", () => {
    const html = renderAccountDeployFlow({
      step: { step: "error", message: "Insufficient STRK balance" },
      keypair: Option.some(KEYPAIR),
    })

    expect(html).toContain("Try Again")
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="polite"')
  })
})
