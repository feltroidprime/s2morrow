# tests/bounded_int_circuit/test_compilation.py
"""
Integration tests that compile generated Cairo code with scarb.
Each test creates a micro scarb package and verifies compilation succeeds.

Based on edge cases from:
https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268
"""
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


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
