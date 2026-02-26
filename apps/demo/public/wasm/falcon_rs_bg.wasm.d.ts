/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const create_verification_hint: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const keygen: (a: number, b: number) => [number, number, number];
export const ntt_public_key: (a: number, b: number) => [number, number, number, number];
export const pack_public_key_wasm: (a: number, b: number) => [number, number, number, number];
export const public_key_length: () => number;
export const salt_length: () => number;
export const sign: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const sign_for_starknet: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const verify: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_drop_slice: (a: number, b: number) => void;
export const __wbindgen_start: () => void;
