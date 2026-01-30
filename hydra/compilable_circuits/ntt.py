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
