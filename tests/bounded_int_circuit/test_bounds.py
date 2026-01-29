# tests/bounded_int_circuit/test_bounds.py
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


class TestAddBounds:
    """Test bound propagation for addition. Based on corelib tests."""

    def test_add_unsigned_bounds(self):
        """u8 + u8 -> [0, 510]. From corelib: AddHelper<u8, u8> Result = BoundedInt<0, 510>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a + b

        assert c.min_bound == 0
        assert c.max_bound == 510

    def test_add_signed_bounds(self):
        """i8 + i8 -> [-256, 254]. From corelib: AddHelper<i8, i8> Result = BoundedInt<-256, 254>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a + b

        assert c.min_bound == -256
        assert c.max_bound == 254

    def test_add_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a + b

        assert len(circuit.operations) == 1
        op = circuit.operations[0]
        assert op.op_type == "ADD"
        assert op.operands == [a, b]
        assert op.result is c

    def test_add_operator_overload(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 100)
        b = circuit.input("b", 0, 50)

        c = a + b  # Using operator overload

        assert c.bounds == (0, 150)

    def test_add_asymmetric_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 10, 20)
        b = circuit.input("b", 5, 15)

        c = a + b

        assert c.bounds == (15, 35)


class TestSubBounds:
    """Test bound propagation for subtraction. Based on corelib tests."""

    def test_sub_unsigned_produces_signed(self):
        """u8 - u8 -> [-255, 255]. From corelib: SubHelper<u8, u8> Result = BoundedInt<-255, 255>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a - b

        assert c.min_bound == -255
        assert c.max_bound == 255

    def test_sub_signed_bounds(self):
        """i8 - i8 -> [-255, 255]. From corelib: SubHelper<i8, i8> Result = BoundedInt<-255, 255>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a - b

        # -128 - 127 = -255, 127 - (-128) = 255
        assert c.min_bound == -255
        assert c.max_bound == 255

    def test_sub_asymmetric_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 10, 20)
        b = circuit.input("b", 5, 15)

        c = a - b

        # min: 10 - 15 = -5, max: 20 - 5 = 15
        assert c.bounds == (-5, 15)

    def test_sub_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a - b

        assert len(circuit.operations) == 1
        op = circuit.operations[0]
        assert op.op_type == "SUB"
