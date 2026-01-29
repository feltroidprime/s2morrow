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


class TestMulBounds:
    """Test bound propagation for multiplication. Based on corelib tests."""

    def test_mul_unsigned_bounds(self):
        """u8 * u8 -> [0, 65025]. From corelib: MulHelper<u8, u8> Result = BoundedInt<0, 65025>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a * b

        assert c.min_bound == 0
        assert c.max_bound == 65025  # 255 * 255

    def test_mul_signed_bounds(self):
        """i8 * i8 -> [-16256, 16384]. From corelib: MulHelper<i8, i8>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a * b

        # Corners: -128*-128=16384, -128*127=-16256, 127*-128=-16256, 127*127=16129
        assert c.min_bound == -16256
        assert c.max_bound == 16384

    def test_mul_mixed_signs(self):
        """Test multiplication with one positive, one negative range."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -10, 10)
        b = circuit.input("b", 5, 15)

        c = a * b

        # Corners: -10*5=-50, -10*15=-150, 10*5=50, 10*15=150
        assert c.min_bound == -150
        assert c.max_bound == 150

    def test_mul_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a * b

        op = circuit.operations[0]
        assert op.op_type == "MUL"


class TestDivRemBounds:
    """Test bound propagation for division. Based on corelib DivRemHelper tests."""

    def test_divrem_basic(self):
        """Division of [128, 255] by [3, 8]."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 128, 255)
        b = circuit.input("b", 3, 8)

        q, r = a.div_rem(b)

        # Quotient: 128/8=16 to 255/3=85
        assert q.min_bound == 16
        assert q.max_bound == 85
        # Remainder: [0, 7] (max divisor - 1)
        assert r.min_bound == 0
        assert r.max_bound == 7

    def test_divrem_by_constant(self):
        """Division by integer constant."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q, r = a.div_rem(256)

        # 0/256=0, 510/256=1
        assert q.bounds == (0, 1)
        assert r.bounds == (0, 255)

    def test_div_operator(self):
        """Test // operator returns quotient only."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q = a // 256

        assert q.bounds == (0, 1)

    def test_mod_operator(self):
        """Test % operator returns remainder only."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        r = a % 256

        assert r.bounds == (0, 255)

    def test_divrem_creates_linked_operations(self):
        """div_rem should create linked DIV and REM operations."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q, r = a.div_rem(256)

        # Should have 2 operations (or 1 combined - implementation detail)
        assert q.source is not None
        assert r.source is not None


class TestReduceBounds:
    """Test modular reduction."""

    def test_reduce_resets_to_modulus_range(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a + b  # [0, 24576]
        d = c.reduce()

        assert d.bounds == (0, 12288)

    def test_reduce_negative_input(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a - b  # [-12288, 12288]
        d = c.reduce()

        assert d.bounds == (0, 12288)

    def test_reduce_tracks_quotient_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 24576)

        b = a.reduce()

        op = b.source
        assert op.op_type == "REDUCE"
        # Quotient should be [0, 1] for this range
        assert op.extra["q_bounds"] == (0, 1)

    def test_reduce_large_negative(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", -150994944, 150994944)

        b = a.reduce()

        assert b.bounds == (0, 12288)
        # For negative inputs, reduce() shifts to positive first, so quotient is non-negative
        q_min, q_max = b.source.extra["q_bounds"]
        assert q_min >= 0  # After shifting, quotient is non-negative


class TestAutoReduce:
    """Test automatic reduction when bounds exceed threshold."""

    def test_auto_reduce_on_mul_exceeding_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**20)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # 12288 * 12288 = 150994944 > 2**20 = 1048576
        c = a * b

        # Should auto-reduce
        assert c.bounds == (0, 12288)
        assert c.source.op_type == "REDUCE"

    def test_no_auto_reduce_below_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**64)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a * b  # 150994944 < 2**64

        assert c.bounds == (0, 150994944)
        assert c.source.op_type == "MUL"

    def test_auto_reduce_negative_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**16)
        a = circuit.input("a", -1000, 1000)
        b = circuit.input("b", -1000, 1000)

        # -1000 * 1000 = -1000000 < -2**16
        c = a * b

        assert c.bounds == (0, 12288)

    def test_hard_max_bound_limit(self):
        """max_bound is capped at 2**128."""
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**200)

        assert circuit.max_bound == 2**128
