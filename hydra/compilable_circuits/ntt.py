# hydra/compilable_circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from hydra.bounded_int_circuit import BoundedIntCircuit
from hydra.bounded_int_circuit.variable import BoundedIntVar
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class NttCircuitGenerator:
    """Generate NTT circuits using BoundedIntCircuit DSL."""

    Q = 12289
    SQR1 = roots_dict_Zq[2][0]  # = 1479, sqrt(-1) mod Q

    def __init__(self, n: int = 512):
        """
        Initialize generator for NTT of size n.

        Args:
            n: Transform size (must be power of 2, max 1024)
        """
        if n & (n - 1) != 0 or n < 2 or n > 1024:
            raise ValueError(f"n must be power of 2 in [2, 1024], got {n}")
        self.n = n
        self.circuit = BoundedIntCircuit(f"ntt_{n}_inner", modulus=self.Q)

    def _register_constants(self) -> None:
        """Register all twiddle factor constants needed for NTT."""
        # SQR1 for base case (n=2)
        self.circuit.register_constant(self.SQR1, "SQR1")

        # Q for modular reduction
        self.circuit.register_constant(self.Q, "Q")

        # Register roots for each merge level
        # For merge at size `size`, we need roots from roots_dict_Zq[size]
        # We only use even-indexed roots (0, 2, 4, ...) since the algorithm
        # uses w[2*i] for index i in [0, n/2)
        size = 4
        while size <= self.n:
            roots = roots_dict_Zq[size]
            # Even indices only: roots[0], roots[2], roots[4], ...
            for i in range(0, len(roots), 2):
                root_value = roots[i]
                root_name = f"W{size}_{i // 2}"
                if root_value not in self.circuit.constants:
                    self.circuit.register_constant(root_value, root_name)
            size *= 2

    def _ntt_base_case(self, f0: BoundedIntVar, f1: BoundedIntVar) -> list[BoundedIntVar]:
        """
        NTT base case for n=2.

        Computes:
            r0 = (f0 + sqr1 * f1) mod Q
            r1 = (f0 - sqr1 * f1) mod Q

        Returns unreduced results (caller should reduce).
        """
        sqr1 = self.circuit.constant(self.SQR1, "sqr1")

        # f1 * sqr1
        f1_j = f1 * sqr1

        # f0 + f1_j, f0 - f1_j
        even = f0 + f1_j
        odd = f0 - f1_j

        return [even, odd]

    def _split(self, coeffs: list) -> tuple[list, list]:
        """
        Split list into even and odd indices.

        This is a compile-time operation on the coefficient list,
        not a circuit operation.
        """
        return coeffs[::2], coeffs[1::2]

    def _merge_ntt(
        self,
        f0_ntt: list[BoundedIntVar],
        f1_ntt: list[BoundedIntVar],
        size: int
    ) -> list[BoundedIntVar]:
        """
        Merge two NTT halves using butterflies with twiddle factors.

        For i in [0, size/2):
            result[2*i]   = f0_ntt[i] + w[2*i] * f1_ntt[i]
            result[2*i+1] = f0_ntt[i] - w[2*i] * f1_ntt[i]

        where w = roots_dict_Zq[size].

        Returns unreduced results.
        """
        roots = roots_dict_Zq[size]
        result = []

        for i in range(len(f0_ntt)):
            # Get twiddle factor w[2*i]
            twiddle_value = roots[2 * i]
            twiddle = self.circuit.constant(twiddle_value, f"w{size}_{i}")

            # prod = f1_ntt[i] * twiddle
            prod = f1_ntt[i] * twiddle

            # even = f0_ntt[i] + prod
            even = f0_ntt[i] + prod

            # odd = f0_ntt[i] - prod
            odd = f0_ntt[i] - prod

            result.append(even)
            result.append(odd)

        return result

    def simulate(self, values: list[int]) -> list[int]:
        """
        Execute the traced operations on actual values.

        This replays the circuit operations on concrete integers
        to verify correctness without generating Cairo code.
        """
        if len(values) != len(self.circuit.inputs):
            raise ValueError(
                f"Expected {len(self.circuit.inputs)} values, got {len(values)}"
            )

        # Map variable names to their current values
        env: dict[str, int] = {}

        # Initialize inputs
        for i, inp in enumerate(self.circuit.inputs):
            env[inp.name] = values[i]

        # Initialize constants
        for val, name in self.circuit.constants.items():
            const_name = name.lower() + "_const" if name != "Q" else "q_const"
            # Find the constant variable in circuit
            for var_name, var in self.circuit.variables.items():
                if var.min_bound == var.max_bound == val:
                    env[var_name] = val

        # Execute operations
        for op in self.circuit.operations:
            if op.op_type == "ADD":
                a, b = op.operands
                env[op.result.name] = env[a.name] + env[b.name]
            elif op.op_type == "SUB":
                a, b = op.operands
                env[op.result.name] = env[a.name] - env[b.name]
            elif op.op_type == "MUL":
                a, b = op.operands
                env[op.result.name] = env[a.name] * env[b.name]
            elif op.op_type == "REDUCE":
                a = op.operands[0]
                modulus = op.extra.get("modulus", self.Q)
                env[op.result.name] = env[a.name] % modulus
            elif op.op_type in ("DIV", "REM"):
                # Handle div_rem pairs
                a = op.operands[0]
                b = op.operands[1] if len(op.operands) > 1 else None
                divisor = env[b.name] if b else op.extra.get("modulus", self.Q)
                if op.op_type == "DIV":
                    env[op.result.name] = env[a.name] // divisor
                else:
                    env[op.result.name] = env[a.name] % divisor

        # Collect outputs
        return [env[out.name] for out in self.circuit.outputs]
