# tests/compilable_circuits/test_intt_felt252.py
"""Tests for INTT felt252 mode generation."""
import pytest
from cairo_gen.circuits.intt import InttCircuitGenerator


def test_intt_generate_felt252_mode():
    """INTT generator should support felt252 mode."""
    gen = InttCircuitGenerator(n=4)  # Small N for fast test

    code = gen.generate(mode="felt252")

    # Should have native felt252 arithmetic
    assert "let tmp_" in code
    # Should NOT have BoundedInt helper traits
    assert "AddHelper" not in code
    assert "SubHelper" not in code
    assert "MulHelper" not in code


def test_intt_generate_full_felt252_mode():
    """Full INTT with wrapper should use Array<felt252>."""
    gen = InttCircuitGenerator(n=4)

    code = gen.generate_full(mode="felt252")

    # Wrapper should use felt252 arrays
    assert "Array<felt252>" in code
    # Inner function should exist
    assert "intt_4_inner" in code
