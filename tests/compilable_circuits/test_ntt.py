# tests/compilable_circuits/test_ntt.py
"""Tests for NTT circuit generator."""
import pytest
from hydra.compilable_circuits.ntt import NttCircuitGenerator
from hydra.falcon_py.ntt_constants import roots_dict_Zq


# Reference NTT implementation for testing
# (Avoiding import issues with hydra.falcon_py.ntt)
Q = 12289
SQR1 = roots_dict_Zq[2][0]  # = 1479


def split(f):
    """Split list into even and odd indices."""
    return f[::2], f[1::2]


def merge_ntt(f_list_ntt):
    """Merge two NTT halves."""
    f0_ntt, f1_ntt = f_list_ntt
    n = 2 * len(f0_ntt)
    w = roots_dict_Zq[n]
    f_ntt = [0] * n
    for i in range(n // 2):
        f_ntt[2 * i + 0] = (f0_ntt[i] + w[2 * i] * f1_ntt[i]) % Q
        f_ntt[2 * i + 1] = (f0_ntt[i] - w[2 * i] * f1_ntt[i]) % Q
    return f_ntt


def reference_ntt(f):
    """Reference NTT implementation for testing."""
    n = len(f)
    if n > 2:
        f0, f1 = split(f)
        f0_ntt = reference_ntt(f0)
        f1_ntt = reference_ntt(f1)
        f_ntt = merge_ntt([f0_ntt, f1_ntt])
    elif n == 2:
        f_ntt = [0] * n
        f_ntt[0] = (f[0] + SQR1 * f[1]) % Q
        f_ntt[1] = (f[0] - SQR1 * f[1]) % Q
    return f_ntt


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


class TestBaseCase:
    """Test n=2 base case NTT."""

    def test_ntt_2_creates_circuit(self):
        """n=2 NTT creates a circuit with correct structure."""
        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        # Create inputs
        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        # Run base case
        result = gen._ntt_base_case(f0, f1)

        # Should return 2 outputs
        assert len(result) == 2

        # Check operations were recorded (mul, add, sub)
        assert len(gen.circuit.operations) >= 3

    def test_ntt_2_matches_reference(self):
        """n=2 NTT matches reference algorithm values."""
        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        # Create inputs
        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        # Run base case
        result = gen._ntt_base_case(f0, f1)

        # Mark outputs
        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        # Simulate with test values
        test_input = [100, 200]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"Expected {expected}, got {actual}"


class TestSplitMerge:
    """Test split and merge operations."""

    def test_split_even_odd(self):
        """Split separates even and odd indices."""
        gen = NttCircuitGenerator(n=4)

        # Create mock inputs as list
        coeffs = ["f0", "f1", "f2", "f3"]

        f0, f1 = gen._split(coeffs)

        # Even indices: f0, f2
        assert f0 == ["f0", "f2"]
        # Odd indices: f1, f3
        assert f1 == ["f1", "f3"]

    def test_merge_ntt_n4(self):
        """Merge combines two n=2 NTTs into n=4."""
        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # Create inputs for two base NTTs
        f0_ntt = [
            gen.circuit.input("a0", 0, gen.Q - 1),
            gen.circuit.input("a1", 0, gen.Q - 1),
        ]
        f1_ntt = [
            gen.circuit.input("b0", 0, gen.Q - 1),
            gen.circuit.input("b1", 0, gen.Q - 1),
        ]

        # Merge
        result = gen._merge_ntt(f0_ntt, f1_ntt, size=4)

        # Result should have 4 elements
        assert len(result) == 4

        # Operations should include multiplications by twiddle factors
        mul_ops = [op for op in gen.circuit.operations if op.op_type == "MUL"]
        assert len(mul_ops) >= 2  # At least 2 twiddle multiplications


class TestRecursiveNtt:
    """Test full recursive NTT."""

    def test_ntt_4_matches_reference(self):
        """n=4 NTT matches reference algorithm."""
        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # Create inputs
        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(4)]

        # Run NTT
        result = gen._ntt(inputs)

        # Mark outputs with reduction
        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        # Test with values
        test_input = [100, 200, 300, 400]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=4: Expected {expected}, got {actual}"

    def test_ntt_8_matches_reference(self):
        """n=8 NTT matches reference algorithm."""
        gen = NttCircuitGenerator(n=8)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(8)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, 9))
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=8: Expected {expected}, got {actual}"
