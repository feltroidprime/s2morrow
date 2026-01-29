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

    # Format min bound (use 'n' prefix for negative)
    if min_b < 0:
        min_str = f"n{abs(min_b)}"
    else:
        min_str = str(min_b)

    # Format max bound (use 'n' prefix for negative)
    if max_b < 0:
        max_str = f"n{abs(max_b)}"
    else:
        max_str = str(max_b)

    return f"BInt_{min_str}_{max_str}"
