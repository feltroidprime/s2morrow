# hydra/bounded_int_circuit/circuit.py
from __future__ import annotations
from .variable import BoundedIntVar
from .operation import Operation


class BoundedIntCircuit:
    """
    A circuit that records bounded integer operations and compiles to Cairo.
    """

    MAX_BOUND_LIMIT = 2**128

    def __init__(
        self,
        name: str,
        modulus: int,
        max_bound: int = 2**64,
    ):
        self.name = name
        self.modulus = modulus
        self.max_bound = min(max_bound, self.MAX_BOUND_LIMIT)

        # Tracking
        self.variables: dict[str, BoundedIntVar] = {}
        self.operations: list[Operation] = []
        self.inputs: list[BoundedIntVar] = []
        self.outputs: list[BoundedIntVar] = []
        self.constants: dict[int, str] = {}  # value -> name

        # Type registry for code generation
        self.bound_types: set[tuple[int, int]] = set()

        # Counter for auto-generated variable names
        self._var_counter = 0

    def _next_var_name(self) -> str:
        """Generate a unique variable name."""
        name = f"tmp_{self._var_counter}"
        self._var_counter += 1
        return name

    def input(self, name: str, min_val: int, max_val: int) -> BoundedIntVar:
        """Create an input variable with known bounds."""
        if name in self.variables:
            raise ValueError(f"Variable '{name}' already exists")

        var = BoundedIntVar(
            circuit=self,
            name=name,
            min_bound=min_val,
            max_bound=max_val,
            source=None,
        )

        self.variables[name] = var
        self.inputs.append(var)
        self.bound_types.add((min_val, max_val))

        return var
