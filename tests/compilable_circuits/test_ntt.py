# tests/compilable_circuits/test_ntt.py
"""Tests for NTT circuit generator."""
import pytest
from hydra.compilable_circuits.ntt import NttCircuitGenerator
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class TestConstantRegistration:
    """Test twiddle factor constant registration."""

    def test_sqr1_registered(self):
        """SQR1 constant is registered."""
        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        assert 1479 in gen.circuit.constants
        assert gen.circuit.constants[1479] == "SQR1"

    def test_roots_registered_for_n4(self):
        """Twiddle factors registered for n=4."""
        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # n=4 needs SQR1 for base case and W4_0 for merge
        assert 1479 in gen.circuit.constants  # SQR1

        # W4_0 = roots_dict_Zq[4][0] = 4043
        assert 4043 in gen.circuit.constants
        assert gen.circuit.constants[4043] == "W4_0"

    def test_roots_registered_for_n8(self):
        """Twiddle factors registered for n=8."""
        gen = NttCircuitGenerator(n=8)
        gen._register_constants()

        # n=8 needs W4, W8 roots
        # W8 roots: roots_dict_Zq[8] = [5736, 6553, 4134, 8155, ...]
        # We use even indices: W8_0=5736, W8_1=4134
        roots_8 = roots_dict_Zq[8]
        assert roots_8[0] in gen.circuit.constants  # W8_0 = 5736
        assert roots_8[2] in gen.circuit.constants  # W8_1 = 4134
