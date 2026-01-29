# hydra/bounded_int_circuit/codegen.py
"""Cairo code generation utilities for BoundedIntCircuit."""


def type_name(min_b: int, max_b: int, modulus: int, constants: dict[int, str]) -> str:
    """Generate readable type name for bounds."""
    # Singleton constant
    if min_b == max_b and min_b in constants:
        return f"{constants[min_b]}Const"

    # Primary modular type
    if min_b == 0 and max_b == modulus - 1:
        return "Zq"

    # Negative bounds
    if min_b < 0:
        return f"BInt_n{abs(min_b)}_{max_b}"

    return f"BInt_{min_b}_{max_b}"
