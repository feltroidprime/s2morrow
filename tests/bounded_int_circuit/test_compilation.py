# tests/bounded_int_circuit/test_compilation.py
"""
Integration tests that compile generated Cairo code with scarb.
Each test creates a micro scarb package and verifies compilation succeeds.

Based on edge cases from:
https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268
"""
import pytest
from cairo_gen import BoundedIntCircuit


class TestCompilationBasicOps:
    """Test that generated code for basic operations compiles."""

    def test_compile_add_unsigned(self, assert_compiles):
        """u8 + u8 -> [0, 510]"""
        circuit = BoundedIntCircuit("add_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a + b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_add_unsigned")

    def test_compile_add_signed(self, assert_compiles):
        """i8 + i8 -> [-256, 254]"""
        circuit = BoundedIntCircuit("add_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a + b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_add_signed")

    def test_compile_sub_unsigned(self, assert_compiles):
        """u8 - u8 -> [-255, 255]"""
        circuit = BoundedIntCircuit("sub_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a - b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_sub_unsigned")

    def test_compile_sub_signed(self, assert_compiles):
        """i8 - i8 -> [-255, 255]"""
        circuit = BoundedIntCircuit("sub_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a - b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_sub_signed")

    def test_compile_mul_unsigned(self, assert_compiles):
        """u8 * u8 -> [0, 65025]"""
        circuit = BoundedIntCircuit("mul_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a * b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mul_unsigned")

    def test_compile_mul_signed(self, assert_compiles):
        """i8 * i8 -> [-16256, 16384]"""
        circuit = BoundedIntCircuit("mul_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a * b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mul_signed")


class TestCompilationDivRem:
    """Test that generated code for division operations compiles."""

    def test_compile_reduce(self, assert_compiles):
        """Test modular reduction compiles."""
        circuit = BoundedIntCircuit("reduce_test", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 24576)
        b = a.reduce()
        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_reduce")

    def test_compile_reduce_negative(self, assert_compiles):
        """Test reduction of negative range compiles."""
        circuit = BoundedIntCircuit("reduce_neg", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", -12288, 12288)
        b = a.reduce()
        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_reduce_negative")

    def test_compile_divrem_basic(self, assert_compiles):
        """Test div_rem with constant divisor compiles."""
        circuit = BoundedIntCircuit("divrem_test", modulus=256)
        circuit.register_constant(8, "EIGHT")
        a = circuit.input("a", 128, 255)
        q, r = a.div_rem(8)
        circuit.output(q, "quotient")
        circuit.output(r, "remainder")

        code = circuit.compile()
        assert_compiles(code, "test_divrem")

    def test_compile_div_by_constant(self, assert_compiles):
        """Test division by constant compiles."""
        circuit = BoundedIntCircuit("div_const", modulus=256)
        circuit.register_constant(100, "HUNDRED")
        a = circuit.input("a", 0, 1000)
        q = a // 100
        circuit.output(q, "result")

        code = circuit.compile()
        assert_compiles(code, "test_div_const")

    def test_compile_mod_operator(self, assert_compiles):
        """Test % operator compiles."""
        circuit = BoundedIntCircuit("mod_test", modulus=256)
        circuit.register_constant(100, "HUNDRED")
        a = circuit.input("a", 0, 1000)
        r = a % 100
        circuit.output(r, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mod")


class TestCompilationComplex:
    """Test compilation of more complex circuits."""

    def test_compile_ntt_butterfly(self, assert_compiles):
        """Test NTT butterfly pattern compiles."""
        circuit = BoundedIntCircuit("ntt_butterfly", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        w = circuit.input("w", 0, 12288)

        sum_ab = a + b
        diff_ab = a - b
        prod = diff_ab * w

        r0 = sum_ab.reduce()
        r1 = prod.reduce()

        circuit.output(r0, "r0")
        circuit.output(r1, "r1")

        code = circuit.compile()
        assert_compiles(code, "test_ntt_butterfly")

    def test_compile_chained_operations(self, assert_compiles):
        """Test chained operations compile."""
        circuit = BoundedIntCircuit("chain", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = circuit.input("c", 0, 12288)

        # (a + b) * c, then reduce
        t1 = a + b
        t2 = t1 * c
        result = t2.reduce()

        circuit.output(result, "result")

        code = circuit.compile()
        assert_compiles(code, "test_chain")

    def test_compile_multiple_reductions(self, assert_compiles):
        """Test multiple reductions in one circuit."""
        circuit = BoundedIntCircuit("multi_reduce", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        sum1 = (a + b).reduce()
        sum2 = (sum1 + a).reduce()
        sum3 = (sum2 + b).reduce()

        circuit.output(sum3, "result")

        code = circuit.compile()
        assert_compiles(code, "test_multi_reduce")

    def test_compile_falcon_style_mod(self, assert_compiles):
        """Test Falcon-style modular arithmetic (Q=12289)."""
        circuit = BoundedIntCircuit("falcon_mod", modulus=12289)
        circuit.register_constant(12289, "Q")

        # Zq inputs
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # Add and reduce
        sum_val = a + b  # [0, 24576]
        reduced = sum_val.reduce()  # [0, 12288]

        circuit.output(reduced, "result")

        code = circuit.compile()
        assert_compiles(code, "test_falcon_mod")

    def test_compile_wide_range(self, assert_compiles):
        """Test compilation with wide intermediate ranges."""
        circuit = BoundedIntCircuit("wide_range", modulus=12289, max_bound=2**64)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # Large product without auto-reduce
        prod = a * b  # [0, 150994944]

        # Explicit reduce
        result = prod.reduce()

        circuit.output(result, "result")

        code = circuit.compile()
        assert_compiles(code, "test_wide_range")


class TestCompilationEdgeCases:
    """
    Edge cases from Cairo corelib bounded_int tests.
    Reference: https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268
    """

    def test_compile_boundary_values_u8(self, assert_compiles):
        """Test boundary values for u8."""
        circuit = BoundedIntCircuit("boundary_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        # Max + Max
        c = a + b  # [0, 510]
        circuit.output(c, "sum")

        # Max * Max
        d = a * b  # [0, 65025]
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_boundary_u8")

    def test_compile_boundary_values_i8(self, assert_compiles):
        """Test boundary values for i8."""
        circuit = BoundedIntCircuit("boundary_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        # -128 + -128 = -256
        c = a + b  # [-256, 254]
        circuit.output(c, "sum")

        # -128 * -128 = 16384
        d = a * b  # [-16256, 16384]
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_boundary_i8")

    def test_compile_asymmetric_ranges(self, assert_compiles):
        """Test operations on asymmetric ranges."""
        circuit = BoundedIntCircuit("asymmetric", modulus=256)
        a = circuit.input("a", 10, 50)
        b = circuit.input("b", 100, 200)

        c = a + b  # [110, 250]
        d = a - b  # [-190, -50]
        e = a * b  # [1000, 10000]

        circuit.output(c, "sum")
        circuit.output(d, "diff")
        circuit.output(e, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_asymmetric")

    def test_compile_singleton_constant(self, assert_compiles):
        """Test UnitInt singleton types."""
        circuit = BoundedIntCircuit("singleton", modulus=256)
        circuit.register_constant(42, "ANSWER")

        a = circuit.input("a", 0, 255)
        b = circuit.constant(42, "const_42")

        c = a + b  # Constant addition
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_singleton")

    def test_compile_large_negative_range(self, assert_compiles):
        """Test large negative ranges."""
        circuit = BoundedIntCircuit("large_neg", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", -150994944, 150994944)
        b = a.reduce()

        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_large_neg")

    def test_compile_zero_crossing(self, assert_compiles):
        """Test range that crosses zero."""
        circuit = BoundedIntCircuit("zero_cross", modulus=256)
        a = circuit.input("a", -50, 50)
        b = circuit.input("b", -50, 50)

        c = a + b  # [-100, 100]
        d = a * b  # [-2500, 2500]

        circuit.output(c, "sum")
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_zero_cross")


class TestFullIntegration:
    """Full integration test matching the design doc example."""

    def test_design_doc_example(self, assert_compiles):
        """Test the exact example from the design document."""
        circuit = BoundedIntCircuit(
            name="ntt_butterfly",
            modulus=12289,
            max_bound=2**64,
        )

        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        w = circuit.input("w", 0, 12288)

        sum_ab = a + b
        diff_ab = a - b
        prod = diff_ab * w

        # Verify bounds at each step
        assert sum_ab.bounds == (0, 24576)
        assert diff_ab.bounds == (-12288, 12288)
        assert prod.bounds == (-150994944, 150994944)

        r0 = sum_ab.reduce()
        r1 = prod.reduce()

        circuit.output(r0, "r0")
        circuit.output(r1, "r1")

        code = circuit.compile()

        # Verify generated code structure
        assert "type Zq = BoundedInt<0, 12288>;" in code
        assert "type BInt_0_24576 = BoundedInt<0, 24576>;" in code
        assert "type BInt_n12288_12288 = BoundedInt<-12288, 12288>;" in code
        assert "impl Add_Zq_Zq of AddHelper<Zq, Zq>" in code
        assert "impl Sub_Zq_Zq of SubHelper<Zq, Zq>" in code
        assert "pub fn ntt_butterfly(a: Zq, b: Zq, w: Zq)" in code

        # Compile with scarb
        assert_compiles(code, "test_design_doc")

    def test_write_to_file(self, tmp_path):
        """Test writing circuit to file."""
        circuit = BoundedIntCircuit("test_write", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        circuit.output((a + b).reduce(), "result")

        output_path = tmp_path / "generated.cairo"
        circuit.write(str(output_path))

        assert output_path.exists()
        content = output_path.read_text()
        assert "pub fn test_write" in content
