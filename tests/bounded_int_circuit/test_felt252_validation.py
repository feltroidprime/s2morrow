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
