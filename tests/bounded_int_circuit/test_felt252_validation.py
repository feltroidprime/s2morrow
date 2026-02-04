"""Tests for felt252 mode validation."""
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


def test_validate_felt252_mode_within_bounds():
    """Circuit with bounds under 2^128 should pass validation."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y  # bounds: [0, 24576]
    circuit.output(z, "z")

    # Should not raise
    circuit._validate_felt252_mode()


def test_validate_felt252_mode_exceeds_bounds():
    """Circuit with bounds >= 2^128 should fail validation."""
    circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**200)
    x = circuit.input("x", 0, 2**130)
    y = circuit.input("y", 0, 2**130)
    z = x + y  # bounds: [0, 2^131]
    circuit.output(z, "z")

    with pytest.raises(ValueError, match="Bounds exceed 2\\^128"):
        circuit._validate_felt252_mode()


def test_validate_felt252_mode_negative_bounds():
    """Negative bounds should also be checked."""
    circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**200)
    x = circuit.input("x", -(2**130), 0)
    y = circuit.input("y", 0, 12288)
    z = x - y  # bounds: [-(2^130)-12288, 0]
    circuit.output(z, "z")

    with pytest.raises(ValueError, match="Bounds exceed 2\\^128"):
        circuit._validate_felt252_mode()


import math


def test_compute_shift_no_negatives():
    """No negatives means shift is 0."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y  # bounds: [0, 24576]
    circuit.output(z, "z")

    assert circuit._compute_shift() == 0


def test_compute_shift_with_negatives():
    """Shift should be ceil(|min_bound| / Q) * Q."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y  # bounds: [-12288, 12288]
    circuit.output(z, "z")

    # ceil(12288 / 12289) * 12289 = 1 * 12289 = 12289
    assert circuit._compute_shift() == 12289


def test_compute_shift_larger_negative():
    """Larger negatives need larger shift."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", -100000, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output(z, "z")

    # ceil(100000 / 12289) * 12289 = 9 * 12289 = 110601
    expected = math.ceil(100000 / 12289) * 12289
    assert circuit._compute_shift() == expected


def test_generate_felt252_imports():
    """Imports should include BoundedInt machinery for output reduction."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output(x, "out")

    imports = circuit._generate_felt252_imports()

    assert "use core::num::traits::Zero;" in imports
    assert "BoundedInt" in imports
    assert "upcast" in imports
    assert "bounded_int_div_rem" in imports
    assert "DivRemHelper" in imports


def test_generate_felt252_constants_basic():
    """Constants should be plain felt252 values."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    circuit.register_constant(1479, "SQR1")
    circuit.register_constant(5765, "W4_0")
    x = circuit.input("x", 0, 12288)
    circuit.output(x, "out")

    constants = circuit._generate_felt252_constants()

    assert "const SQR1: felt252 = 1479;" in constants
    assert "const W4_0: felt252 = 5765;" in constants


def test_generate_felt252_constants_reduction_machinery():
    """Should include SHIFT, Q types, and DivRemHelper."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y  # Creates negative bounds, so SHIFT > 0
    circuit.output(z, "out")

    constants = circuit._generate_felt252_constants()

    # SHIFT constant
    assert "const SHIFT: felt252 = 12289;" in constants
    # Q constant type
    assert "type QConst = UnitInt<12289>;" in constants
    # NonZero Q
    assert "const nz_q: NonZero<QConst> = 12289;" in constants
    # ShiftedT type (shift + max_bound)
    assert "type ShiftedT = BoundedInt<0," in constants
    # RemT type
    assert "type RemT = BoundedInt<0, 12288>;" in constants
    # DivRemHelper impl
    assert "impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst>" in constants


def test_generate_felt252_op_add():
    """ADD should generate native + operator."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y

    # Find the ADD operation
    add_op = next(op for op in circuit.operations if op.op_type == "ADD")

    result = circuit._generate_felt252_op(add_op)
    assert result == "let tmp_0 = x + y;"


def test_generate_felt252_op_sub():
    """SUB should generate native - operator."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y

    sub_op = next(op for op in circuit.operations if op.op_type == "SUB")

    result = circuit._generate_felt252_op(sub_op)
    assert result == "let tmp_0 = x - y;"


def test_generate_felt252_op_mul():
    """MUL should generate native * operator."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x * y

    mul_op = next(op for op in circuit.operations if op.op_type == "MUL")

    result = circuit._generate_felt252_op(mul_op)
    assert result == "let tmp_0 = x * y;"


def test_generate_felt252_op_mul_constant():
    """MUL with constant should use constant name."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    circuit.register_constant(1479, "SQR1")
    sqr1 = circuit.constant(1479, "SQR1")
    x = circuit.input("x", 0, 12288)
    z = x * sqr1

    mul_op = next(op for op in circuit.operations if op.op_type == "MUL")

    result = circuit._generate_felt252_op(mul_op)
    assert result == "let tmp_0 = x * SQR1;"


def test_generate_felt252_function_signature():
    """Function should use felt252 for all inputs and outputs."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output(z, "out")

    func = circuit._generate_felt252_function("test_func")

    assert "pub fn test_func(x: felt252, y: felt252) -> felt252" in func


def test_generate_felt252_function_body():
    """Function body should have operations and output reduction."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output(z, "out")

    func = circuit._generate_felt252_function("test_func")

    # Operation (variable renamed to 'out' by output())
    assert "let out = x + y;" in func
    # Output reduction
    assert "let out: ShiftedT = (out + SHIFT).try_into().unwrap();" in func
    assert "let (_, out_rem) = bounded_int_div_rem(out, nz_q);" in func
    assert "let out: felt252 = upcast(out_rem);" in func
    # Return
    assert "out" in func


def test_generate_felt252_function_multiple_outputs():
    """Multiple outputs should all be reduced and returned as tuple."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    circuit.output(x + y, "r0")
    circuit.output(x - y, "r1")

    func = circuit._generate_felt252_function("test_func")

    assert "-> (felt252, felt252)" in func
    assert "(r0, r1)" in func


def test_compile_felt252_combines_all_parts():
    """_compile_felt252 should combine imports, constants, and function."""
    circuit = BoundedIntCircuit("test", modulus=12289)
    circuit.register_constant(1479, "SQR1")
    sqr1 = circuit.constant(1479, "SQR1")
    x = circuit.input("x", 0, 12288)
    z = x * sqr1
    circuit.output(z, "out")

    code = circuit._compile_felt252("test_func")

    # Imports
    assert "use corelib_imports::bounded_int" in code
    # Constants
    assert "const SQR1: felt252 = 1479;" in code
    assert "const SHIFT: felt252 =" in code
    # Function
    assert "pub fn test_func(" in code


def test_compile_mode_bounded_default():
    """Default mode should be 'bounded' (existing behavior)."""
    circuit = BoundedIntCircuit("test_func", modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output(x, "out")

    # Default should produce bounded int code
    code = circuit.compile()

    assert "AddHelper" in code or "type Zq" in code  # Bounded mode markers


def test_compile_mode_felt252():
    """mode='felt252' should produce felt252 arithmetic."""
    circuit = BoundedIntCircuit("test_func", modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output(z, "out")

    code = circuit.compile(mode="felt252")

    # Should have native operations, not bounded
    assert "let out = x + y;" in code
    assert "AddHelper" not in code


def test_compile_mode_invalid():
    """Invalid mode should raise ValueError."""
    circuit = BoundedIntCircuit("test_func", modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output(x, "out")

    with pytest.raises(ValueError, match="Unknown compilation mode"):
        circuit.compile(mode="invalid")
