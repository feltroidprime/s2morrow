# tests/compilable_circuits/test_intt.py
"""Tests for INTT circuit generator."""
import pytest
import random
import subprocess
from cairo_gen.circuits.intt import InttCircuitGenerator
from falcon_py.ntt_constants import roots_dict_Zq, inv_mod_q


# Reference implementations for testing
Q = 12289
I2 = 6145  # inverse of 2 mod Q
SQR1 = roots_dict_Zq[2][0]  # = 1479


def reference_split_ntt(f_ntt):
    """Split NTT representation using inverse butterflies."""
    n = len(f_ntt)
    w = roots_dict_Zq[n]
    f0_ntt = [0] * (n // 2)
    f1_ntt = [0] * (n // 2)
    for i in range(n // 2):
        f0_ntt[i] = (I2 * (f_ntt[2 * i] + f_ntt[2 * i + 1])) % Q
        f1_ntt[i] = (I2 * (f_ntt[2 * i] - f_ntt[2 * i + 1]) * inv_mod_q[w[2 * i]]) % Q
    return f0_ntt, f1_ntt


def merge(f0, f1):
    """Interleave two coefficient lists."""
    n = 2 * len(f0)
    f = [0] * n
    for i in range(n // 2):
        f[2 * i] = f0[i]
        f[2 * i + 1] = f1[i]
    return f


def reference_intt(f_ntt):
    """Reference INTT implementation for testing."""
    n = len(f_ntt)
    if n > 2:
        f0_ntt, f1_ntt = reference_split_ntt(f_ntt)
        f0 = reference_intt(f0_ntt)
        f1 = reference_intt(f1_ntt)
        f = merge(f0, f1)
    elif n == 2:
        f = [0] * n
        f[0] = (I2 * (f_ntt[0] + f_ntt[1])) % Q
        f[1] = (I2 * inv_mod_q[SQR1] * (f_ntt[0] - f_ntt[1])) % Q
    return f


def reference_ntt(f):
    """Reference NTT (forward) for round-trip tests."""

    def split_coeff(f):
        return f[::2], f[1::2]

    def merge_ntt_halves(f0_ntt, f1_ntt):
        n = 2 * len(f0_ntt)
        w = roots_dict_Zq[n]
        f_ntt = [0] * n
        for i in range(n // 2):
            f_ntt[2 * i] = (f0_ntt[i] + w[2 * i] * f1_ntt[i]) % Q
            f_ntt[2 * i + 1] = (f0_ntt[i] - w[2 * i] * f1_ntt[i]) % Q
        return f_ntt

    n = len(f)
    if n > 2:
        f0, f1 = split_coeff(f)
        f0_ntt = reference_ntt(f0)
        f1_ntt = reference_ntt(f1)
        return merge_ntt_halves(f0_ntt, f1_ntt)
    elif n == 2:
        return [
            (f[0] + SQR1 * f[1]) % Q,
            (f[0] - SQR1 * f[1]) % Q,
        ]


class TestConstantRegistration:
    """Test inverse twiddle factor constant registration."""

    def test_i2_registered(self):
        """I2 (inverse of 2) is registered."""
        gen = InttCircuitGenerator(n=2)
        gen._register_constants()

        assert 6145 in gen.circuit.constants
        assert gen.circuit.constants[6145] == "I2"

    def test_inv_sqr1_registered(self):
        """INV_SQR1 is registered."""
        gen = InttCircuitGenerator(n=2)
        gen._register_constants()

        inv_sqr1 = inv_mod_q[SQR1]
        assert inv_sqr1 in gen.circuit.constants
        assert gen.circuit.constants[inv_sqr1] == "INV_SQR1"

    def test_q_registered(self):
        """Q constant is registered."""
        gen = InttCircuitGenerator(n=2)
        gen._register_constants()

        assert Q in gen.circuit.constants
        assert gen.circuit.constants[Q] == "Q"

    def test_inverse_roots_registered_for_n4(self):
        """Inverse twiddle factors registered for n=4."""
        gen = InttCircuitGenerator(n=4)
        gen._register_constants()

        # n=4 needs inverse of roots_dict_Zq[4] at even indices
        roots_4 = roots_dict_Zq[4]
        inv_root_0 = inv_mod_q[roots_4[0]]
        assert inv_root_0 in gen.circuit.constants

    def test_inverse_roots_registered_for_n8(self):
        """Inverse twiddle factors registered for n=8."""
        gen = InttCircuitGenerator(n=8)
        gen._register_constants()

        # n=8 needs inverse of roots_dict_Zq[8] at even indices
        roots_8 = roots_dict_Zq[8]
        inv_root_0 = inv_mod_q[roots_8[0]]
        inv_root_2 = inv_mod_q[roots_8[2]]
        assert inv_root_0 in gen.circuit.constants
        assert inv_root_2 in gen.circuit.constants


class TestBaseCase:
    """Test n=2 base case INTT."""

    def test_intt_2_creates_circuit(self):
        """n=2 INTT creates a circuit with correct structure."""
        gen = InttCircuitGenerator(n=2)
        gen._register_constants()

        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        result = gen._intt_base_case(f0, f1)

        assert len(result) == 2

        # Check operations were recorded (add, sub, mul)
        assert len(gen.circuit.operations) >= 3

    def test_intt_2_matches_reference(self):
        """n=2 INTT matches reference algorithm values."""
        gen = InttCircuitGenerator(n=2)
        gen._register_constants()

        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        result = gen._intt_base_case(f0, f1)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [100, 200]
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"Expected {expected}, got {actual}"

    def test_intt_2_multiple_inputs(self):
        """n=2 INTT correct for several input pairs."""
        test_cases = [
            [0, 0],
            [1, 0],
            [0, 1],
            [Q - 1, Q - 1],
            [Q - 1, 0],
            [5000, 7000],
        ]
        for test_input in test_cases:
            gen = InttCircuitGenerator(n=2)
            gen._register_constants()

            f0 = gen.circuit.input("f0", 0, gen.Q - 1)
            f1 = gen.circuit.input("f1", 0, gen.Q - 1)
            result = gen._intt_base_case(f0, f1)
            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            expected = reference_intt(test_input[:])
            actual = gen.simulate(test_input[:])
            assert actual == expected, f"Input {test_input}: expected {expected}, got {actual}"


class TestSplitNttAndMerge:
    """Test split_ntt and merge operations."""

    def test_merge_interleaves(self):
        """Merge interleaves two lists."""
        gen = InttCircuitGenerator(n=4)

        coeffs_a = ["a0", "a1"]
        coeffs_b = ["b0", "b1"]

        result = gen._merge(coeffs_a, coeffs_b)
        assert result == ["a0", "b0", "a1", "b1"]

    def test_split_ntt_n4(self):
        """split_ntt on n=4 produces two halves with correct structure."""
        gen = InttCircuitGenerator(n=4)
        gen._register_constants()

        f_ntt = [
            gen.circuit.input("f0", 0, gen.Q - 1),
            gen.circuit.input("f1", 0, gen.Q - 1),
            gen.circuit.input("f2", 0, gen.Q - 1),
            gen.circuit.input("f3", 0, gen.Q - 1),
        ]

        f0_ntt, f1_ntt = gen._split_ntt(f_ntt, size=4)

        assert len(f0_ntt) == 2
        assert len(f1_ntt) == 2

        # Operations should include multiplications by inverse twiddle factors
        mul_ops = [op for op in gen.circuit.operations if op.op_type == "MUL"]
        assert len(mul_ops) >= 2  # At least i2 * sum and i2 * diff * inv_w


class TestRecursiveIntt:
    """Test full recursive INTT."""

    def test_intt_4_matches_reference(self):
        """n=4 INTT matches reference algorithm."""
        gen = InttCircuitGenerator(n=4)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(4)]
        result = gen._intt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [100, 200, 300, 400]
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=4: Expected {expected}, got {actual}"

    def test_intt_8_matches_reference(self):
        """n=8 INTT matches reference algorithm."""
        gen = InttCircuitGenerator(n=8)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(8)]
        result = gen._intt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, 9))
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=8: Expected {expected}, got {actual}"


class TestLargerSizes:
    """Test INTT at larger sizes."""

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_intt_matches_reference_sequential(self, n):
        """INTT matches reference for sequential input."""
        gen = InttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._intt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, n + 1))
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} sequential: mismatch"

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_intt_matches_reference_random(self, n):
        """INTT matches reference for random input."""
        random.seed(42)

        gen = InttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._intt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [random.randint(0, gen.Q - 1) for _ in range(n)]
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} random: mismatch"


def _build_intt_circuit(n):
    """Build and return an INTT circuit generator with traced operations."""
    gen = InttCircuitGenerator(n=n)
    gen._register_constants()
    inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
    result = gen._intt(inputs)
    for i, out in enumerate(result):
        gen.circuit.output(out.reduce(), f"r{i}")
    return gen


@pytest.fixture(scope="module")
def intt_512_circuit():
    """Build n=512 circuit once for all tests in this module."""
    return _build_intt_circuit(512)


class TestIntt512Correctness:
    """Thorough correctness tests for n=512 INTT circuit against reference."""

    Q = 12289

    @pytest.mark.parametrize("seed", list(range(10)))
    def test_random_inputs(self, intt_512_circuit, seed):
        """Circuit matches reference INTT on uniformly random inputs."""
        rng = random.Random(seed)
        test_input = [rng.randint(0, self.Q - 1) for _ in range(512)]

        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])

        assert actual == expected, (
            f"seed={seed}: first mismatch at index "
            f"{next(i for i in range(512) if actual[i] != expected[i])}"
        )

    def test_all_zeros(self, intt_512_circuit):
        """INTT(0, ..., 0) = (0, ..., 0)."""
        test_input = [0] * 512
        actual = intt_512_circuit.simulate(test_input)
        assert actual == [0] * 512

    def test_all_ones(self, intt_512_circuit):
        """INTT of constant-1 polynomial in NTT domain."""
        test_input = [1] * 512
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_all_max(self, intt_512_circuit):
        """INTT with all inputs at Q-1."""
        test_input = [self.Q - 1] * 512
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_single_nonzero_first(self, intt_512_circuit):
        """INTT of delta function at index 0: [1, 0, 0, ...]."""
        test_input = [1] + [0] * 511
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_single_nonzero_last(self, intt_512_circuit):
        """INTT of delta function at last index: [0, ..., 0, 1]."""
        test_input = [0] * 511 + [1]
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_alternating_pattern(self, intt_512_circuit):
        """INTT of alternating 0, Q-1 at full size."""
        test_input = [0 if i % 2 == 0 else self.Q - 1 for i in range(512)]
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_sequential_values(self, intt_512_circuit):
        """INTT of [1, 2, 3, ..., 512]."""
        test_input = list(range(1, 513))
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_outputs_in_valid_range(self, intt_512_circuit):
        """All outputs are in [0, Q-1] for random inputs."""
        rng = random.Random(999)
        test_input = [rng.randint(0, self.Q - 1) for _ in range(512)]
        actual = intt_512_circuit.simulate(test_input)

        for i, val in enumerate(actual):
            assert 0 <= val < self.Q, f"output[{i}] = {val} out of range [0, {self.Q})"

    def test_boundary_values_mixed(self, intt_512_circuit):
        """Mix of 0 and Q-1 at specific positions (boundary stress test)."""
        test_input = [0] * 256 + [self.Q - 1] * 256
        expected = reference_intt(test_input[:])
        actual = intt_512_circuit.simulate(test_input[:])
        assert actual == expected

    def test_circuit_stats(self, intt_512_circuit):
        """Circuit has expected complexity for n=512."""
        stats = intt_512_circuit.circuit.stats()
        assert stats["num_operations"] > 5000, "Expected >5000 operations for n=512"


class TestRoundTrip:
    """Test NTT -> INTT round trip property."""

    @pytest.mark.parametrize("n", [2, 4, 8, 16, 32])
    def test_ntt_then_intt_is_identity(self, n):
        """intt(ntt(x)) == x for various sizes."""
        rng = random.Random(123)
        test_input = [rng.randint(0, Q - 1) for _ in range(n)]

        ntt_output = reference_ntt(test_input[:])
        recovered = reference_intt(ntt_output[:])

        assert recovered == test_input, (
            f"n={n}: round trip failed, "
            f"first mismatch at {next(i for i in range(n) if recovered[i] != test_input[i])}"
        )

    @pytest.mark.parametrize("n", [2, 4, 8, 16, 32])
    def test_intt_then_ntt_is_identity(self, n):
        """ntt(intt(x)) == x for various sizes."""
        rng = random.Random(456)
        test_input = [rng.randint(0, Q - 1) for _ in range(n)]

        intt_output = reference_intt(test_input[:])
        recovered = reference_ntt(intt_output[:])

        assert recovered == test_input, (
            f"n={n}: round trip failed, "
            f"first mismatch at {next(i for i in range(n) if recovered[i] != test_input[i])}"
        )

    def test_circuit_ntt_then_intt_512(self, intt_512_circuit):
        """Circuit INTT inverts reference NTT for n=512."""
        rng = random.Random(789)
        original = [rng.randint(0, Q - 1) for _ in range(512)]

        ntt_output = reference_ntt(original[:])
        recovered = intt_512_circuit.simulate(ntt_output[:])

        assert recovered == original, (
            f"Round trip failed at index "
            f"{next(i for i in range(512) if recovered[i] != original[i])}"
        )

    @pytest.mark.parametrize("seed", [0, 1, 2])
    def test_circuit_round_trip_multiple_seeds(self, intt_512_circuit, seed):
        """Circuit INTT round-trip with multiple random seeds."""
        rng = random.Random(seed + 1000)
        original = [rng.randint(0, Q - 1) for _ in range(512)]

        ntt_output = reference_ntt(original[:])
        recovered = intt_512_circuit.simulate(ntt_output[:])

        assert recovered == original


class TestCodeGeneration:
    """Test Cairo code generation."""

    def test_generate_intt_2_bounded(self):
        """Generate bounded Cairo code for n=2 INTT."""
        gen = InttCircuitGenerator(n=2)
        code = gen.generate(mode="bounded")

        assert "pub fn intt_2_inner(f0: Zq, f1: Zq)" in code
        assert "use corelib_imports::bounded_int::" in code
        assert "type Zq = BoundedInt<0, 12288>;" in code

    def test_generate_intt_2_felt252(self):
        """Generate felt252 Cairo code for n=2 INTT."""
        gen = InttCircuitGenerator(n=2)
        code = gen.generate(mode="felt252")

        assert "fn intt_2_inner(" in code
        assert "felt252" in code

    def test_generate_intt_4_compiles(self, assert_compiles):
        """Generate Cairo code for n=4 INTT that compiles."""
        gen = InttCircuitGenerator(n=4)
        code = gen.generate()

        assert_compiles(code, "test_intt_4")

    def test_generate_intt_8_compiles(self, assert_compiles):
        """Generate Cairo code for n=8 INTT that compiles."""
        gen = InttCircuitGenerator(n=8)
        code = gen.generate()

        assert_compiles(code, "test_intt_8")


class TestPublicApiWrapper:
    """Test public API wrapper generation."""

    def test_generate_full_includes_wrapper_bounded(self):
        """Full generation (bounded) includes public intt_4 wrapper with Zq."""
        gen = InttCircuitGenerator(n=4)
        code = gen.generate_full(mode="bounded")

        assert "fn intt_4_inner(" in code
        assert "pub fn intt_4(mut f: Array<Zq>) -> Array<Zq>" in code
        assert "multi_pop_front::<4>()" in code
        assert "boxed.unbox()" in code
        assert "array![r0, r1, r2, r3]" in code

    def test_generate_full_includes_wrapper_felt252(self):
        """Full generation (felt252) includes public intt_4 wrapper with felt252."""
        gen = InttCircuitGenerator(n=4)
        code = gen.generate_full(mode="felt252")

        assert "fn intt_4_inner(" in code
        assert "pub fn intt_4(mut f: Array<felt252>) -> Array<felt252>" in code
        assert "multi_pop_front::<4>()" in code
        assert "boxed.unbox()" in code
        assert "array![r0, r1, r2, r3]" in code

    def test_generate_full_header(self):
        """Full generation includes auto-generated header."""
        gen = InttCircuitGenerator(n=4)
        code = gen.generate_full()

        assert "// Auto-generated by cairo_gen/circuits/intt.py" in code
        assert "// DO NOT EDIT MANUALLY" in code


class TestRegenerateCli:
    """Test regeneration CLI."""

    def test_cli_generates_file(self, tmp_path):
        """CLI generates intt_felt252.cairo file (default mode is felt252)."""
        result = subprocess.run(
            [
                "python3", "-m", "cairo_gen.circuits.regenerate",
                "intt",
                "--n", "8",
                "--output-dir", str(tmp_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        output_file = tmp_path / "intt_felt252.cairo"
        assert output_file.exists(), "Output file not created"

        content = output_file.read_text()
        assert "pub fn intt_8(" in content
        assert "intt_8_inner" in content


class TestEdgeCases:
    """Test edge cases for INTT generation."""

    def test_all_zeros(self):
        """INTT of all zeros should be all zeros."""
        for n in [2, 4, 8, 16]:
            gen = InttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._intt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [0] * n
            expected = reference_intt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected == [0] * n

    def test_all_max_values(self):
        """INTT handles all inputs at Q-1."""
        for n in [2, 4, 8]:
            gen = InttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._intt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [gen.Q - 1] * n
            expected = reference_intt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected

    def test_alternating_pattern(self):
        """INTT handles alternating 0, Q-1 pattern."""
        n = 8
        gen = InttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._intt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [0 if i % 2 == 0 else gen.Q - 1 for i in range(n)]
        expected = reference_intt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected

    def test_invalid_size(self):
        """Invalid sizes raise ValueError."""
        with pytest.raises(ValueError):
            InttCircuitGenerator(n=3)
        with pytest.raises(ValueError):
            InttCircuitGenerator(n=0)
        with pytest.raises(ValueError):
            InttCircuitGenerator(n=2048)
