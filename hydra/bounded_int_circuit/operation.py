# hydra/bounded_int_circuit/operation.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .variable import BoundedIntVar


@dataclass
class Operation:
    """Records a single operation in the circuit trace."""
    op_type: str  # "ADD", "SUB", "MUL", "DIV", "REM", "REDUCE"
    operands: list[BoundedIntVar]
    result: BoundedIntVar
    extra: dict = field(default_factory=dict)
    comment: str | None = None
