import { describe, it, expect } from "bun:test"
import { Layer, ManagedRuntime } from "effect"
import { FalconSigner } from "../../services/FalconSigner"
import { FalconService } from "../../services/FalconService"
import { WasmRuntime } from "../../services/WasmRuntime"
import type { WasmModule } from "../../services/WasmRuntime"

const MOCK_SIGNATURE = Array.from({ length: 61 }, (_, i) => `0x${i.toString(16)}`)

const mockWasm: WasmModule = {
  keygen: () => ({ sk: new Uint8Array(1281), vk: new Uint8Array(896) }),
  sign: () => ({ signature: new Uint8Array(666), salt: new Uint8Array(40) }),
  verify: () => true,
  create_verification_hint: () => new Uint16Array(512),
  pack_public_key_wasm: () => Array.from({ length: 29 }, () => "0x0"),
  public_key_length: () => 896,
  salt_length: () => 40,
  sign_for_starknet: () => MOCK_SIGNATURE,
}

const falconRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(
    Layer.provide(Layer.succeed(WasmRuntime, mockWasm)),
  ),
)

const V3_DETAILS = {
  walletAddress: "0x1",
  chainId: "0x534e5f5345504f4c4941" as const,
  version: "0x3" as const,
  cairoVersion: "1" as const,
  nonce: "0x0",
  resourceBounds: {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
  },
  tip: 0n,
  paymasterData: [],
  accountDeploymentData: [],
  nonceDataAvailabilityMode: "L1" as const,
  feeDataAvailabilityMode: "L1" as const,
}

describe("FalconSigner", () => {
  it("implements signTransaction and returns string[]", async () => {
    const signer = new FalconSigner(
      new Uint8Array(1281),
      new Int32Array(512),
      falconRuntime,
    )

    const sig = await signer.signTransaction(
      [{ contractAddress: "0x1", entrypoint: "transfer", calldata: [] }],
      V3_DETAILS,
    )

    const sigArray = sig as string[]
    expect(Array.isArray(sigArray)).toBe(true)
    expect(sigArray.length).toBe(61)
    expect(sigArray[0]).toBe("0x0")
  })

  it("getPubKey returns placeholder", async () => {
    const signer = new FalconSigner(
      new Uint8Array(1281),
      new Int32Array(512),
      falconRuntime,
    )

    expect(await signer.getPubKey()).toBe("0x0")
  })
})
