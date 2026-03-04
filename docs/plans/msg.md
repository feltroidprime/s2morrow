*Falcon-512 NTT: `bounded_int_div_rem` dominates Sierra size — is this expected?*

We're building an on-chain Falcon-512 post-quantum signature verifier. The core is an unrolled NTT-512 using `felt252` arithmetic with `BoundedInt` for output reduction mod Q=12289.

Full file: [ntt_felt252.cairo](https://github.com/feltroidprime/s2morrow/blob/master/packages/falcon/src/ntt_felt252.cairo)

The NTT does 2,304 butterfly ops (felt252 mul/add/sub) then reduces each of the 512 outputs via [`bounded_int_div_rem` (L8469-L8492)](https://github.com/feltroidprime/s2morrow/blob/master/packages/falcon/src/ntt_felt252.cairo#L8469-L8492) with a [`ShiftedT` type, 109-bit upper bound (L9-L14)](https://github.com/feltroidprime/s2morrow/blob/master/packages/falcon/src/ntt_felt252.cairo#L9-L14).

We measured Sierra contract size by swapping in noop versions of the NTT:

```
Version                          Reductions  Butterflies  Sierra felts
Bare minimum (512 I/O, 1 div)          1           0          3,588
Noop (512 I/O, 512 div)              512           0        106,287
Full NTT                             512       2,304        150,788
#[inline(never)] wrapper             512       2,304        162,719
Starknet limit                         —           —         81,920
```

*The 512 `bounded_int_div_rem` calls alone cost ~103K Sierra felts (~201 felts each), which is 1.3x the Starknet contract size limit.* The 2,304 butterfly ops only add ~44K felts (~19 felts each).

We tried wrapping the reduction in a helper function — with default inlining it gets fully inlined (same size), and with `#[inline(never)]` it gets *worse* (+12K felts from call overhead). This confirms the ~201 felts/call is the intrinsic Sierra representation of `bounded_int_div_rem`, not a function inlining issue.

The divisor is a constant `Q = 12289` ([`UnitInt<12289>` in zq.cairo](https://github.com/feltroidprime/s2morrow/blob/master/packages/falcon/src/zq.cairo)), and the dividend bound is ~109 bits. We expected this to compile down to a single `divmod` hint + range check, but the Sierra cost suggests much more is happening.

*Questions:*
- Is ~200 Sierra felts per `bounded_int_div_rem` expected for a 109-bit dividend / small constant divisor?
- Is there a cheaper way to reduce mod a small constant in Sierra? (e.g. direct hint + assert, or a different `BoundedInt` pattern?)
- Any plans to optimize `bounded_int_div_rem` Sierra codegen for constant divisors?
