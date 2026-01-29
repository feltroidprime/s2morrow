# hydra/bounded_int_circuit/variable.py
from __future__ import annotations
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .circuit import BoundedIntCircuit
    from .operation import Operation


@dataclass
class BoundedIntVar:
    """A variable in the circuit with tracked bounds."""
    circuit: BoundedIntCircuit
    name: str
    min_bound: int
    max_bound: int
    source: Operation | None = None

    @property
    def bounds(self) -> tuple[int, int]:
        return (self.min_bound, self.max_bound)

    @property
    def bit_width(self) -> int:
        return max(abs(self.min_bound), abs(self.max_bound)).bit_length()

    def inspect(self) -> str:
        return f"{self.name}: BoundedInt<{self.min_bound}, {self.max_bound}>"

    def __repr__(self) -> str:
        return self.inspect()

    # Operator overloading
    def __add__(self, other: BoundedIntVar) -> BoundedIntVar:
        return self.circuit.add(self, other)

    def __sub__(self, other: BoundedIntVar) -> BoundedIntVar:
        return self.circuit.sub(self, other)

    def __mul__(self, other: BoundedIntVar) -> BoundedIntVar:
        return self.circuit.mul(self, other)

    def __floordiv__(self, other: BoundedIntVar | int) -> BoundedIntVar:
        return self.circuit.div(self, other)

    def __mod__(self, other: BoundedIntVar | int) -> BoundedIntVar:
        return self.circuit.mod(self, other)

    def div_rem(self, divisor: BoundedIntVar | int) -> tuple[BoundedIntVar, BoundedIntVar]:
        return self.circuit.div_rem(self, divisor)

    def reduce(self, modulus: int | None = None) -> BoundedIntVar:
        return self.circuit.reduce(self, modulus)
