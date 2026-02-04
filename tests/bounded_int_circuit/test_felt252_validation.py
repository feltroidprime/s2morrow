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
