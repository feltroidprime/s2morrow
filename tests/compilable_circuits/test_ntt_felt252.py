"""Tests for NTT felt252 mode generation."""
import pytest
from cairo_gen.circuits.ntt import NttCircuitGenerator


def test_ntt_generate_felt252_mode():
    """NTT generator should support felt252 mode."""
    gen = NttCircuitGenerator(n=4)  # Small N for fast test

    code = gen.generate(mode="felt252")

    # Should have native felt252 arithmetic
    assert "let tmp_" in code
    # Should NOT have BoundedInt helper traits
    assert "AddHelper" not in code
    assert "SubHelper" not in code
    assert "MulHelper" not in code


def test_ntt_generate_full_felt252_mode():
    """Full NTT with wrapper should use Array<felt252>."""
    gen = NttCircuitGenerator(n=4)

    code = gen.generate_full(mode="felt252")

    # Wrapper should use felt252 arrays
    assert "Array<felt252>" in code
    # Inner function should exist
    assert "ntt_4_inner" in code
