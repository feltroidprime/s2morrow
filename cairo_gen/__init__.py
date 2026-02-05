# cairo_gen/__init__.py
"""
Cairo code generation library for bounded integer circuits.

This package provides a DSL for building arithmetic circuits with bounded
integer variables that can be compiled to Cairo source code.
"""
from .circuit import BoundedIntCircuit, BoundedIntVar, Operation

__all__ = ["BoundedIntCircuit", "BoundedIntVar", "Operation"]
