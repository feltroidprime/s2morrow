# tests/compilable_circuits/test_ntt.py
"""Tests for NTT circuit generator."""
import pytest
from cairo_gen.circuits.ntt import NttCircuitGenerator
from falcon_py.ntt_constants import roots_dict_Zq


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


import random


class TestLargerSizes:
    """Test NTT at larger sizes up to 512."""

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_ntt_matches_reference_sequential(self, n):
        """NTT matches reference for sequential input."""
        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, n + 1))
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} sequential: mismatch"

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_ntt_matches_reference_random(self, n):
        """NTT matches reference for random input."""
        random.seed(42)

        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [random.randint(0, gen.Q - 1) for _ in range(n)]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} random: mismatch"

    pass


def _build_ntt_circuit(n):
    """Build and return an NTT circuit generator with traced operations."""
    gen = NttCircuitGenerator(n=n)
    gen._register_constants()
    inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
    result = gen._ntt(inputs)
    for i, out in enumerate(result):
        gen.circuit.output(out.reduce(), f"r{i}")
    return gen


@pytest.fixture(scope="module")
def ntt_512_circuit():
    """Build n=512 circuit once for all tests in this module."""
    return _build_ntt_circuit(512)


class TestNtt512Correctness:
    """Thorough correctness tests for n=512 NTT circuit against reference."""

    Q = 12289

    @pytest.mark.parametrize("seed", list(range(10)))
    def test_random_inputs(self, ntt_512_circuit, seed):
        """Circuit matches reference NTT on uniformly random inputs."""
        rng = random.Random(seed)
        test_input = [rng.randint(0, self.Q - 1) for _ in range(512)]

        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])

        assert actual == expected, (
            f"seed={seed}: first mismatch at index "
            f"{next(i for i in range(512) if actual[i] != expected[i])}"
        )

    def test_all_zeros(self, ntt_512_circuit):
        """NTT(0, ..., 0) = (0, ..., 0)."""
        test_input = [0] * 512
        actual = ntt_512_circuit.simulate(test_input)
        assert actual == [0] * 512

    def test_all_ones(self, ntt_512_circuit):
        """NTT of constant-1 polynomial."""
        test_input = [1] * 512
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_all_max(self, ntt_512_circuit):
        """NTT with all inputs at Q-1."""
        test_input = [self.Q - 1] * 512
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_single_nonzero_first(self, ntt_512_circuit):
        """NTT of delta function at index 0: [1, 0, 0, ...]."""
        test_input = [1] + [0] * 511
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_single_nonzero_last(self, ntt_512_circuit):
        """NTT of delta function at last index: [0, ..., 0, 1]."""
        test_input = [0] * 511 + [1]
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_alternating_pattern(self, ntt_512_circuit):
        """NTT of alternating 0, Q-1 at full size."""
        test_input = [0 if i % 2 == 0 else self.Q - 1 for i in range(512)]
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_sequential_values(self, ntt_512_circuit):
        """NTT of [1, 2, 3, ..., 512]."""
        test_input = list(range(1, 513))
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_outputs_in_valid_range(self, ntt_512_circuit):
        """All outputs are in [0, Q-1] for random inputs."""
        rng = random.Random(999)
        test_input = [rng.randint(0, self.Q - 1) for _ in range(512)]
        actual = ntt_512_circuit.simulate(test_input)

        for i, val in enumerate(actual):
            assert 0 <= val < self.Q, f"output[{i}] = {val} out of range [0, {self.Q})"

    def test_boundary_values_mixed(self, ntt_512_circuit):
        """Mix of 0 and Q-1 at specific positions (boundary stress test)."""
        # First half zeros, second half max
        test_input = [0] * 256 + [self.Q - 1] * 256
        expected = reference_ntt(test_input[:])
        actual = ntt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_circuit_stats(self, ntt_512_circuit):
        """Circuit has expected complexity for n=512."""
        stats = ntt_512_circuit.circuit.stats()
        assert stats["num_operations"] > 5000, "Expected >5000 operations for n=512"


class TestCodeGeneration:
    """Test Cairo code generation."""

    def test_generate_ntt_2(self):
        """Generate Cairo code for n=2 NTT."""
        gen = NttCircuitGenerator(n=2)
        code = gen.generate()

        # Check structure
        assert "pub fn ntt_2_inner(f0: Zq, f1: Zq)" in code
        assert "use corelib_imports::bounded_int::" in code
        assert "type Zq = BoundedInt<0, 12288>;" in code

    def test_generate_ntt_4_compiles(self, assert_compiles):
        """Generate Cairo code for n=4 NTT that compiles."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate()

        # Should compile
        assert_compiles(code, "test_ntt_4")

    def test_generate_ntt_8_compiles(self, assert_compiles):
        """Generate Cairo code for n=8 NTT that compiles."""
        gen = NttCircuitGenerator(n=8)
        code = gen.generate()

        assert_compiles(code, "test_ntt_8")


class TestPublicApiWrapper:
    """Test public API wrapper generation."""

    def test_generate_full_includes_wrapper(self):
        """Full generation includes public ntt_4 wrapper."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate_full()

        # Inner function
        assert "fn ntt_4_inner(" in code

        # Public wrapper
        assert "pub fn ntt_4(mut f: Array<Zq>) -> Array<Zq>" in code
        assert "multi_pop_front::<4>()" in code
        assert "boxed.unbox()" in code
        assert "array![r0, r1, r2, r3]" in code

    def test_generate_full_header(self):
        """Full generation includes auto-generated header."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate_full()

        assert "// Auto-generated by cairo_gen/circuits/ntt.py" in code
        assert "// DO NOT EDIT MANUALLY" in code


import subprocess
import tempfile
from pathlib import Path


class TestRegenerateCli:
    """Test regeneration CLI."""

    def test_cli_generates_file(self, tmp_path):
        """CLI generates ntt_felt252.cairo file (default mode is felt252)."""
        # Run CLI with custom output dir
        result = subprocess.run(
            [
                "python3", "-m", "cairo_gen.circuits.regenerate",
                "ntt",
                "--n", "8",
                "--output-dir", str(tmp_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        # Default mode is felt252, so output is ntt_felt252.cairo
        output_file = tmp_path / "ntt_felt252.cairo"
        assert output_file.exists(), "Output file not created"

        content = output_file.read_text()
        assert "pub fn ntt_8(" in content
        assert "ntt_8_inner" in content


class TestEdgeCases:
    """Test edge cases for NTT generation."""

    def test_all_zeros(self):
        """NTT of all zeros should be all zeros."""
        for n in [2, 4, 8, 16]:
            gen = NttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._ntt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [0] * n
            expected = reference_ntt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected == [0] * n

    def test_all_max_values(self):
        """NTT handles all inputs at Q-1."""
        for n in [2, 4, 8]:
            gen = NttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._ntt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [gen.Q - 1] * n
            expected = reference_ntt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected

    def test_alternating_pattern(self):
        """NTT handles alternating 0, Q-1 pattern."""
        n = 8
        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [0 if i % 2 == 0 else gen.Q - 1 for i in range(n)]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected
