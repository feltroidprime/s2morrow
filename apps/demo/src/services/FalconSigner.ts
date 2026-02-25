import { Cause, Exit, type ManagedRuntime, Option } from "effect"
import {
  type Call,
  type InvocationsSignerDetails,
  type DeployAccountSignerDetails,
  type DeclareSignerDetails,
  type Signature,
  type TypedData,
  SignerInterface,
  hash,
  transaction,
  CallData,
  EDAMode,
  type EDataAvailabilityMode,
  typedData as typedDataUtils,
} from "starknet"
import { FalconService } from "./FalconService"
import { TransactionSignError } from "./errors"

function intDAM(dam: EDataAvailabilityMode): EDAMode {
  if (dam === "L1") return EDAMode.L1
  if (dam === "L2") return EDAMode.L2
  throw new Error(`Unknown EDataAvailabilityMode: ${dam}`)
}

export class FalconSigner extends SignerInterface {
  constructor(
    private readonly sk: Uint8Array,
    private readonly pkNtt: Int32Array,
    private readonly runtime: ManagedRuntime.ManagedRuntime<FalconService, never>,
  ) {
    super()
  }

  async getPubKey(): Promise<string> {
    // Falcon public keys are not a single felt — return a placeholder.
    // The actual PK is the 29 packed felt252 slots stored in the contract.
    return "0x0"
  }

  async signMessage(
    typedDataObj: TypedData,
    accountAddress: string,
  ): Promise<Signature> {
    const msgHash = typedDataUtils.getMessageHash(typedDataObj, accountAddress)
    return this._signHash(msgHash)
  }

  async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails,
  ): Promise<Signature> {
    const compiledCalldata = transaction.getExecuteCalldata(
      transactions,
      transactionsDetail.cairoVersion,
    )
    const txHash = hash.calculateInvokeTransactionHash({
      ...transactionsDetail,
      senderAddress: transactionsDetail.walletAddress,
      compiledCalldata,
      version: transactionsDetail.version,
      nonceDataAvailabilityMode: intDAM(transactionsDetail.nonceDataAvailabilityMode),
      feeDataAvailabilityMode: intDAM(transactionsDetail.feeDataAvailabilityMode),
    })
    return this._signHash(txHash)
  }

  async signDeployAccountTransaction(
    details: DeployAccountSignerDetails,
  ): Promise<Signature> {
    const compiledConstructorCalldata = CallData.compile(
      details.constructorCalldata,
    )
    const txHash = hash.calculateDeployAccountTransactionHash({
      ...details,
      salt: details.addressSalt,
      compiledConstructorCalldata,
      version: details.version,
      nonceDataAvailabilityMode: intDAM(details.nonceDataAvailabilityMode),
      feeDataAvailabilityMode: intDAM(details.feeDataAvailabilityMode),
    })
    return this._signHash(txHash)
  }

  async signDeclareTransaction(
    details: DeclareSignerDetails,
  ): Promise<Signature> {
    const txHash = hash.calculateDeclareTransactionHash({
      ...details,
      version: details.version,
      nonceDataAvailabilityMode: intDAM(details.nonceDataAvailabilityMode),
      feeDataAvailabilityMode: intDAM(details.feeDataAvailabilityMode),
    })
    return this._signHash(txHash)
  }

  private async _signHash(txHash: string): Promise<string[]> {
    const exit = await this.runtime.runPromiseExit(
      FalconService.signForStarknet(this.sk, txHash, this.pkNtt),
    )

    if (Exit.isSuccess(exit)) {
      return exit.value
    }

    const errOpt = Cause.failureOption(exit.cause)
    const msg = Option.match(errOpt, {
      onNone: () => "Falcon signing failed",
      onSome: (e) => e.message,
    })
    throw new TransactionSignError({ message: msg })
  }
}
