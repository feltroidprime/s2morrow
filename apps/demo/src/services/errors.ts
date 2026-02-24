import { Schema } from "effect"

export class WasmLoadError extends Schema.TaggedError<WasmLoadError>()(
  "WasmLoadError",
  { message: Schema.String },
) {}

export class KeygenError extends Schema.TaggedError<KeygenError>()(
  "KeygenError",
  { message: Schema.String },
) {}

export class SigningError extends Schema.TaggedError<SigningError>()(
  "SigningError",
  { message: Schema.String },
) {}

export class VerificationError extends Schema.TaggedError<VerificationError>()(
  "VerificationError",
  { message: Schema.String, step: Schema.String },
) {}

export class HintGenerationError extends Schema.TaggedError<HintGenerationError>()(
  "HintGenerationError",
  { message: Schema.String },
) {}

export class PackingError extends Schema.TaggedError<PackingError>()(
  "PackingError",
  { message: Schema.String },
) {}

export class StarknetRpcError extends Schema.TaggedError<StarknetRpcError>()(
  "StarknetRpcError",
  { message: Schema.String, code: Schema.Number },
) {}

export class AccountDeployError extends Schema.TaggedError<AccountDeployError>()(
  "AccountDeployError",
  { message: Schema.String, txHash: Schema.optional(Schema.String) },
) {}

export class InsufficientFundsError extends Schema.TaggedError<InsufficientFundsError>()(
  "InsufficientFundsError",
  { message: Schema.String, address: Schema.String, required: Schema.String },
) {}
