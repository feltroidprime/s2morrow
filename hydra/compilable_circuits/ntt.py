# hydra/compilable_circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from hydra.bounded_int_circuit import BoundedIntCircuit
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
