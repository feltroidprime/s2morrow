# tests/bounded_int_circuit/test_setup.py
def test_imports():
    from hydra.bounded_int_circuit import BoundedIntVar, Operation
    assert BoundedIntVar is not None
    assert Operation is not None


def test_scarb_fixture_compiles_valid_code(assert_compiles):
    """Verify the scarb fixture works with valid Cairo code."""
    code = """
fn main() -> u32 {
    42
}
"""
    assert_compiles(code, "test_valid")


def test_scarb_fixture_rejects_invalid_code(assert_compile_fails):
    """Verify the scarb fixture catches invalid Cairo code."""
    code = """
fn main() -> u32 {
    this_is_not_valid_cairo!!!
}
"""
    assert_compile_fails(code, "test_invalid")
