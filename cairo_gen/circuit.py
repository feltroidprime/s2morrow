# cairo_gen/circuit.py
"""
BoundedInt circuit DSL for generating Cairo code.

This module provides a DSL for building arithmetic circuits with bounded
integer variables. Operations track bounds automatically and the circuit
can be compiled to Cairo source code.
"""
from __future__ import annotations
from dataclasses import dataclass, field

STARK = 2**251 + 17*2**192 + 1

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


@dataclass
class Operation:
    """Records a single operation in the circuit trace."""
    op_type: str  # "ADD", "SUB", "MUL", "DIV", "REM", "REDUCE"
    operands: list[BoundedIntVar]
    result: BoundedIntVar
    extra: dict = field(default_factory=dict)
    comment: str | None = None


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


class BoundedIntCircuit:
    """
    A circuit that records bounded integer operations and compiles to Cairo.
    """

    MAX_BOUND_LIMIT = 2**300

    def __init__(
        self,
        name: str,
        modulus: int,
        max_bound: int = 2**250,
    ):
        self.name = name
        self.modulus = modulus
        self.max_bound = min(max_bound, self.MAX_BOUND_LIMIT)
        self.auto_reduced_count = 0
        # Tracking
        self.variables: dict[str, BoundedIntVar] = {}
        self.operations: list[Operation] = []
        self.inputs: list[BoundedIntVar] = []
        self.outputs: list[BoundedIntVar] = []
        self.constants: dict[int, str] = {}  # value -> name
        self.used_regular_constants: set[int] = set()  # needs {name}_const
        self.used_nz_constants: set[int] = set()  # needs nz_{name}

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

    def _create_op(
        self,
        op_type: str,
        operands: list[BoundedIntVar],
        min_val: int,
        max_val: int,
        **extra,
    ) -> BoundedIntVar:
        """Create an operation and its result variable."""
        name = self._next_var_name()

        result = BoundedIntVar(
            circuit=self,
            name=name,
            min_bound=min_val,
            max_bound=max_val,
            source=None,  # Will be set below
        )

        op = Operation(
            op_type=op_type,
            operands=operands,
            result=result,
            extra=extra if extra else {},
        )

        result.source = op
        self.variables[name] = result
        self.operations.append(op)
        self.bound_types.add((min_val, max_val))

        return result

    def _maybe_auto_reduce(self, var: BoundedIntVar) -> BoundedIntVar:
        """Auto-reduce if bounds exceed threshold."""
        if var.max_bound > self.max_bound or var.min_bound < -self.max_bound:
            self.auto_reduced_count += 1
            print(f"Auto-reducing {var.name} from {var.bounds} {var.bit_width} bits to {var.reduce().bounds} {var.reduce().bit_width} bits")
            return self.reduce(var)
        return var

    def _add_raw(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
        """Add without auto-reduce. Used internally by reduce() to avoid double reduction."""
        min_val = a.min_bound + b.min_bound
        max_val = a.max_bound + b.max_bound
        return self._create_op("ADD", [a, b], min_val, max_val)

    def add(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
        """Add two bounded integers."""
        min_val = a.min_bound + b.min_bound
        max_val = a.max_bound + b.max_bound
        result = self._create_op("ADD", [a, b], min_val, max_val)
        return self._maybe_auto_reduce(result)

    def sub(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
        """Subtract two bounded integers."""
        min_val = a.min_bound - b.max_bound
        max_val = a.max_bound - b.min_bound
        result = self._create_op("SUB", [a, b], min_val, max_val)
        return self._maybe_auto_reduce(result)

    def mul(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
        """Multiply two bounded integers."""
        # For signed multiplication, consider all corner combinations
        corners = [
            a.min_bound * b.min_bound,
            a.min_bound * b.max_bound,
            a.max_bound * b.min_bound,
            a.max_bound * b.max_bound,
        ]
        min_val = min(corners)
        max_val = max(corners)
        result = self._create_op("MUL", [a, b], min_val, max_val)
        return self._maybe_auto_reduce(result)

    def constant(self, value: int, name: str | None = None) -> BoundedIntVar:
        """Create a constant (singleton) variable."""
        if name is None:
            name = f"const_{value}"

        if name in self.variables:
            return self.variables[name]

        var = BoundedIntVar(
            circuit=self,
            name=name,
            min_bound=value,
            max_bound=value,
            source=None,
        )

        self.variables[name] = var
        # Don't add to bound_types - constants get UnitInt type via register_constant

        return var

    def register_constant(self, value: int, name: str) -> None:
        """Register a named constant for code generation."""
        self.constants[value] = name

    def div_rem(
        self, a: BoundedIntVar, b: BoundedIntVar | int
    ) -> tuple[BoundedIntVar, BoundedIntVar]:
        """Division with remainder. Returns (quotient, remainder)."""
        if isinstance(b, int):
            b = self.constant(b)

        # Quotient bounds - consider all corners, avoiding division by zero
        corners = []
        for a_val in [a.min_bound, a.max_bound]:
            for b_val in [b.min_bound, b.max_bound]:
                if b_val != 0:
                    corners.append(a_val // b_val)

        if not corners:
            raise ValueError("Divisor range includes only zero")

        q_min, q_max = min(corners), max(corners)

        # Remainder bounds: [0, max(|b|) - 1]
        r_max = max(abs(b.min_bound), abs(b.max_bound)) - 1

        # Register quotient bounds type
        self.bound_types.add((q_min, q_max))

        quotient = self._create_op(
            "DIV", [a, b], q_min, q_max,
            q_bounds=(q_min, q_max),
        )
        remainder = self._create_op(
            "REM", [a, b], 0, r_max,
            q_bounds=(q_min, q_max),
            linked_to=quotient.name,
        )

        return quotient, remainder

    def div(self, a: BoundedIntVar, b: BoundedIntVar | int) -> BoundedIntVar:
        """Division - returns quotient only."""
        q, _ = self.div_rem(a, b)
        return q

    def mod(self, a: BoundedIntVar, b: BoundedIntVar | int) -> BoundedIntVar:
        """Modulo - returns remainder only."""
        _, r = self.div_rem(a, b)
        return r

    def reduce(self, var: BoundedIntVar, modulus: int | None = None) -> BoundedIntVar:
        """Explicit modular reduction. Resets bounds to [0, modulus-1]."""
        modulus = modulus or self.modulus

        # For negative inputs, we need to shift to non-negative first
        # Cairo's bounded_int_div_rem doesn't support negative dividends
        if var.min_bound < 0:
            if modulus not in self.constants:
                self.register_constant(modulus, "Q")

            # Calculate how many copies of modulus needed to shift to non-negative
            # ceil(|min_bound| / modulus) copies
            copies_needed = (-var.min_bound + modulus - 1) // modulus
            shift_amount = copies_needed * modulus

            # Create constant for the shift amount
            shift_const = self.constant(shift_amount)
            if shift_amount not in self.constants:
                self.register_constant(shift_amount, f"SHIFT_{copies_needed}Q")

            # Add shift to make non-negative (use _add_raw to avoid double reduction)
            shifted = self._add_raw(var, shift_const)
            var = shifted

        # Compute quotient bounds
        q_max = var.max_bound // modulus
        q_min = var.min_bound // modulus

        # Register quotient bounds type
        self.bound_types.add((q_min, q_max))

        result = self._create_op(
            "REDUCE",
            [var],
            min_val=0,
            max_val=modulus - 1,
            q_bounds=(q_min, q_max),
            modulus=modulus,
        )

        return result

    def output(self, var: BoundedIntVar, name: str | None = None) -> None:
        """Mark a variable as circuit output."""
        if name is not None and name != var.name:
            # Rename variable for output
            old_name = var.name
            if old_name in self.variables:
                del self.variables[old_name]
            var.name = name
            self.variables[name] = var

        self.outputs.append(var)

    def _type_name(self, min_b: int, max_b: int) -> str:
        """Generate readable type name for bounds."""
        return type_name(min_b, max_b, self.modulus, self.constants)

    def _generate_types(self) -> str:
        """Generate all BoundedInt type aliases."""
        lines = []

        # Sort for deterministic output
        for min_b, max_b in sorted(self.bound_types):
            tname = self._type_name(min_b, max_b)
            lines.append(f"type {tname} = BoundedInt<{min_b}, {max_b}>;")

        # Constant types
        for value, name in sorted(self.constants.items()):
            lines.append(f"type {name}Const = UnitInt<{value}>;")

        return "\n".join(lines)

    def _impl_key(self, op: Operation) -> str:
        """Generate a unique key for an impl to avoid duplicates."""
        if op.op_type in ("ADD", "SUB", "MUL"):
            a, b = op.operands
            return f"{op.op_type}_{a.bounds}_{b.bounds}"
        elif op.op_type == "REDUCE":
            a = op.operands[0]
            mod = op.extra.get("modulus", self.modulus)
            return f"REDUCE_{a.bounds}_{mod}"
        elif op.op_type in ("DIV", "REM"):
            a, b = op.operands
            return f"DIVREM_{a.bounds}_{b.bounds}"
        return f"{op.op_type}_{id(op)}"

    def _gen_add_helper(self, op: Operation) -> str:
        a, b = op.operands
        result = op.result
        a_type = self._type_name(*a.bounds)
        b_type = self._type_name(*b.bounds)
        r_type = self._type_name(*result.bounds)

        return f"""impl Add_{a_type}_{b_type} of AddHelper<{a_type}, {b_type}> {{
    type Result = {r_type};
}}"""

    def _gen_sub_helper(self, op: Operation) -> str:
        a, b = op.operands
        result = op.result
        a_type = self._type_name(*a.bounds)
        b_type = self._type_name(*b.bounds)
        r_type = self._type_name(*result.bounds)

        return f"""impl Sub_{a_type}_{b_type} of SubHelper<{a_type}, {b_type}> {{
    type Result = {r_type};
}}"""

    def _gen_mul_helper(self, op: Operation) -> str:
        a, b = op.operands
        result = op.result
        a_type = self._type_name(*a.bounds)
        b_type = self._type_name(*b.bounds)
        r_type = self._type_name(*result.bounds)

        return f"""impl Mul_{a_type}_{b_type} of MulHelper<{a_type}, {b_type}> {{
    type Result = {r_type};
}}"""

    def _gen_divrem_helper(self, op: Operation) -> str:
        a = op.operands[0]
        b = op.operands[1] if len(op.operands) > 1 else None

        a_type = self._type_name(*a.bounds)

        if op.op_type == "REDUCE":
            modulus = op.extra.get("modulus", self.modulus)
            if modulus in self.constants:
                b_type = f"{self.constants[modulus]}Const"
            else:
                b_type = f"UnitInt<{modulus}>"
            q_min, q_max = op.extra["q_bounds"]
            q_type = self._type_name(q_min, q_max)
            r_type = self._type_name(*op.result.bounds)
        else:
            # DIV operation - need to find linked REM for its result bounds
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                b_type = f"{self.constants[b.min_bound]}Const"
            else:
                b_type = self._type_name(*b.bounds)

            q_min, q_max = op.extra["q_bounds"]
            q_type = self._type_name(q_min, q_max)

            # Find linked REM operation (same operands) for remainder type
            r_type = q_type  # default fallback
            for other_op in self.operations:
                if (other_op.op_type == "REM" and
                    other_op.operands == [a, b] and
                    "linked_to" in other_op.extra):
                    r_type = self._type_name(*other_op.result.bounds)
                    break

        return f"""impl DivRem_{a_type}_{b_type} of DivRemHelper<{a_type}, {b_type}> {{
    type DivT = {q_type};
    type RemT = {r_type};
}}"""

    def _generate_helper_impls(self) -> str:
        """Generate AddHelper, SubHelper, MulHelper, DivRemHelper impls."""
        lines = []
        seen = set()

        for op in self.operations:
            impl_key = self._impl_key(op)
            if impl_key in seen:
                continue
            seen.add(impl_key)

            if op.op_type == "ADD":
                lines.append(self._gen_add_helper(op))
            elif op.op_type == "SUB":
                lines.append(self._gen_sub_helper(op))
            elif op.op_type == "MUL":
                lines.append(self._gen_mul_helper(op))
            elif op.op_type == "REDUCE":
                lines.append(self._gen_divrem_helper(op))
            elif op.op_type == "DIV":
                # Generate once for div_rem pair
                lines.append(self._gen_divrem_helper(op))
            # REM is linked to DIV, skip

        return "\n\n".join(lines)

    def _generate_op(self, op: Operation) -> str:
        """Generate Cairo code for a single operation."""
        r = op.result.name
        r_type = self._type_name(*op.result.bounds)

        if op.op_type == "ADD":
            a, b = op.operands
            # Use Cairo constant name if operand is a registered constant
            a_name = a.name
            b_name = b.name
            if a.min_bound == a.max_bound and a.min_bound in self.constants:
                self.used_regular_constants.add(a.min_bound)
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                self.used_regular_constants.add(b.min_bound)
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = add({a_name}, {b_name});"

        elif op.op_type == "SUB":
            a, b = op.operands
            a_name = a.name
            b_name = b.name
            if a.min_bound == a.max_bound and a.min_bound in self.constants:
                self.used_regular_constants.add(a.min_bound)
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                self.used_regular_constants.add(b.min_bound)
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = sub({a_name}, {b_name});"

        elif op.op_type == "MUL":
            a, b = op.operands
            a_name = a.name
            b_name = b.name
            if a.min_bound == a.max_bound and a.min_bound in self.constants:
                self.used_regular_constants.add(a.min_bound)
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                self.used_regular_constants.add(b.min_bound)
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = mul({a_name}, {b_name});"

        elif op.op_type == "REDUCE":
            a = op.operands[0]
            modulus = op.extra.get("modulus", self.modulus)
            if modulus in self.constants:
                self.used_nz_constants.add(modulus)
                nz_name = f"nz_{self.constants[modulus].lower()}"
            else:
                nz_name = f"nz_{modulus}"
            q_name = f"_{r}_q"
            return f"let ({q_name}, {r}): (_, {r_type}) = bounded_int_div_rem({a.name}, {nz_name});"

        elif op.op_type == "DIV":
            a, b = op.operands
            # Check if divisor is a registered constant
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                self.used_nz_constants.add(b.min_bound)
                nz_name = f"nz_{self.constants[b.min_bound].lower()}"
            else:
                nz_name = f"nz_{b.name}"
            # Find the linked REM operation (same operands, created right after DIV)
            rem_name = f"_{r}_rem"  # default
            rem_result_type = "_"
            for other_op in self.operations:
                if (other_op.op_type == "REM" and
                    other_op.operands == [a, b] and
                    "linked_to" in other_op.extra):
                    rem_name = other_op.result.name
                    rem_result_type = self._type_name(*other_op.result.bounds)
                    break
            return f"let ({r}, {rem_name}): ({r_type}, {rem_result_type}) = bounded_int_div_rem({a.name}, {nz_name});"

        elif op.op_type == "REM":
            # REM is generated together with DIV, skip if linked
            if "linked_to" in op.extra:
                return ""  # Already generated with DIV
            a, b = op.operands
            # Check if divisor is a registered constant
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                self.used_nz_constants.add(b.min_bound)
                nz_name = f"nz_{self.constants[b.min_bound].lower()}"
            else:
                nz_name = f"nz_{b.name}"
            q_name = f"_{r}_q"
            return f"let ({q_name}, {r}): (_, {r_type}) = bounded_int_div_rem({a.name}, {nz_name});"

        return f"// Unknown op: {op.op_type}"

    def _generate_function(self) -> str:
        """Generate the main circuit function."""
        # Parameters
        params = ", ".join(
            f"{inp.name}: {self._type_name(*inp.bounds)}"
            for inp in self.inputs
        )

        # Return type
        if len(self.outputs) == 1:
            returns = self._type_name(*self.outputs[0].bounds)
        else:
            returns = "(" + ", ".join(
                self._type_name(*out.bounds)
                for out in self.outputs
            ) + ")"

        # Body
        body_lines = []
        for op in self.operations:
            line = self._generate_op(op)
            if line:  # Skip empty lines (e.g., linked REM)
                if op.comment:
                    line += f"  // {op.comment}"
                body_lines.append(line)

        # Return statement
        if len(self.outputs) == 1:
            body_lines.append(self.outputs[0].name)
        else:
            output_names = ", ".join(out.name for out in self.outputs)
            body_lines.append(f"({output_names})")

        body = "\n    ".join(body_lines)

        return f"""pub fn {self.name}({params}) -> {returns} {{
    {body}
}}"""

    def _generate_imports(self) -> str:
        """Generate Cairo imports."""
        return """use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};"""

    def _generate_constants(self) -> str:
        """Generate constant definitions (only forms that are actually used)."""
        lines = []
        for value, name in sorted(self.constants.items()):
            if value in self.used_regular_constants:
                lines.append(f"const {name.lower()}_const: {name}Const = {value};")
            if value in self.used_nz_constants:
                lines.append(f"const nz_{name.lower()}: NonZero<{name}Const> = {value};")
        return "\n".join(lines)

    def compile(self, mode: str = "bounded") -> str:
        """Compile the circuit to Cairo code.

        Args:
            mode: Compilation mode - "bounded" (default) or "felt252".

        Returns:
            Complete Cairo source code.

        Raises:
            ValueError: If mode is unknown or felt252 mode validation fails.
        """
        if mode == "felt252":
            self._validate_felt252_mode()
            return self._compile_felt252(self.name)
        elif mode == "bounded":
            return self._compile_bounded()
        else:
            raise ValueError(f"Unknown compilation mode: {mode}. Use 'bounded' or 'felt252'.")

    def _compile_bounded(self) -> str:
        """Generate complete Cairo source file using bounded int mode."""
        # Generate function first to populate used_regular_constants and used_nz_constants
        function_code = self._generate_function()
        parts = [
            self._generate_imports(),
            self._generate_types(),
            self._generate_helper_impls(),
            self._generate_constants(),
            function_code,
        ]

        # Filter out empty parts
        parts = [p for p in parts if p.strip()]

        return "\n\n".join(parts)

    def _validate_felt252_mode(self) -> None:
        """Validate that all bounds stay within felt252-safe range.

        Raises:
            ValueError: If any variable's bounds exceed 2^252.
        """
        limit = 2**252
        for var in self.variables.values():
            max_abs = max(abs(var.min_bound), abs(var.max_bound))
            if max_abs >= limit:
                raise ValueError(
                    f"Bounds exceed 2^252, cannot use felt252 mode. "
                    f"Variable '{var.name}' has bounds [{var.min_bound}, {var.max_bound}]"
                )

    def _compute_shift(self) -> int:
        """Compute the shift constant for felt252 mode output reduction.

        Returns the smallest multiple of modulus that makes all outputs non-negative
        when added before reduction.

        Returns:
            SHIFT = ceil(|min_bound| / modulus) * modulus, or 0 if no negatives.
        """
        import math

        # Find worst-case negative bound across all variables
        min_bound = min(var.min_bound for var in self.variables.values())

        if min_bound >= 0:
            return 0

        # Compute ceil(|min_bound| / modulus) * modulus
        abs_min = abs(min_bound)
        return math.ceil(abs_min / self.modulus) * self.modulus

    def _generate_felt252_imports(self) -> str:
        """Generate Cairo imports for felt252 mode."""
        return """// Auto-generated felt252 mode - DO NOT EDIT
use corelib_imports::bounded_int::{BoundedInt, DivRemHelper, bounded_int_div_rem, upcast};
use crate::zq::{Zq, QConst, NZ_Q};
"""

    def _generate_felt252_constants(self) -> str:
        """Generate Cairo reduction types for felt252 mode.

        Note: Circuit constants (twiddle factors) are generated as let bindings
        inside the function rather than module-level const declarations.
        """
        lines = []

        # Compute shift and max bounds for reduction types
        shift = self._compute_shift()
        max_bound = max(var.max_bound for var in self.variables.values())
        shifted_max = shift + max_bound

        # Reduction machinery — QConst and NZ_Q come from crate::zq
        lines.append(f"const SHIFT: felt252 = {shift};")
        lines.append(f"type ShiftedT = BoundedInt<0, {shifted_max}>;")

        # DivRemHelper impl
        div_max = shifted_max // self.modulus
        lines.append("")
        lines.append("impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst> {")
        lines.append(f"    type DivT = BoundedInt<0, {div_max}>;")
        lines.append("    type RemT = Zq;")
        lines.append("}")

        return "\n".join(lines)

    def _get_felt252_operand_name(self, var: "BoundedIntVar") -> str:
        """Get the Cairo name for an operand in felt252 mode.

        For constants, returns the uppercase constant name (e.g., SQR1).
        For other variables, returns the variable name.
        """
        # Check if this variable is a constant (singleton bounds)
        if var.min_bound == var.max_bound:
            value = var.min_bound
            # Look up the uppercase constant name
            if value in self.constants:
                return self.constants[value]
        return var.name

    def _generate_felt252_op(self, op: "Operation") -> str:
        """Generate a single felt252 operation line.

        Args:
            op: The operation to generate.

        Returns:
            Cairo code line for this operation.
        """
        result_name = op.result.name

        if op.op_type == "ADD":
            left = self._get_felt252_operand_name(op.operands[0])
            right = self._get_felt252_operand_name(op.operands[1])
            return f"let {result_name} = {left} + {right};"
        elif op.op_type == "SUB":
            left = self._get_felt252_operand_name(op.operands[0])
            right = self._get_felt252_operand_name(op.operands[1])
            return f"let {result_name} = {left} - {right};"
        elif op.op_type == "MUL":
            left = self._get_felt252_operand_name(op.operands[0])
            right = self._get_felt252_operand_name(op.operands[1])
            return f"let {result_name} = {left} * {right};"
        else:
            raise ValueError(f"Unsupported operation type for felt252 mode: {op.op_type}")

    def _generate_felt252_function(self, func_name: str) -> str:
        """Generate the main Cairo function for felt252 mode.

        Args:
            func_name: Name of the generated function.

        Returns:
            Complete Cairo function as a string.
        """
        lines = []

        # Function signature
        input_params = ", ".join(f"{inp.name}: felt252" for inp in self.inputs)
        if len(self.outputs) == 1:
            return_type = "Zq"
        else:
            return_type = "(" + ", ".join("Zq" for _ in self.outputs) + ")"

        lines.append(f"pub fn {func_name}({input_params}) -> {return_type} {{")

        # Generate let bindings for circuit constants (twiddle factors)
        # self.constants is value -> name mapping
        const_bindings = []
        for value, name in sorted(self.constants.items()):
            # Skip SHIFT_ constants as they're part of bounded mode reduction
            if not name.startswith("SHIFT_"):
                const_bindings.append(f"    let {name} = {value};")

        if const_bindings:
            lines.extend(const_bindings)
            lines.append("")

        # Generate operations (skip REDUCE and related shift-ADD operations in felt252 mode)
        for op in self.operations:
            if op.op_type == "REDUCE":
                continue
            # Skip ADD operations that add a SHIFT constant (part of bounded mode reduction)
            if op.op_type == "ADD":
                for operand in op.operands:
                    if operand.min_bound == operand.max_bound:
                        value = operand.min_bound
                        if value in self.constants and self.constants[value].startswith("SHIFT_"):
                            break
                else:
                    # No SHIFT_ constant found, emit the operation
                    lines.append(f"    {self._generate_felt252_op(op)}")
                continue
            lines.append(f"    {self._generate_felt252_op(op)}")

        lines.append("")

        # Generate output reductions
        # In felt252 mode, outputs may come from REDUCE ops which we skipped.
        # We need to trace back to the unreduced source variable.
        for out_var in self.outputs:
            out_name = out_var.name
            src_name = out_name

            # Trace back through reduction chain to find unreduced source.
            # In bounded mode, reduce() on negative-bounded vars creates:
            #   ADD(var, shift_const) -> REDUCE(shifted)
            # We need to trace back to `var`, skipping the shift-ADD.
            # For non-negative vars, reduce() creates REDUCE(var) directly.
            if out_var.source is not None:
                op = out_var.source
                if op.op_type == "REDUCE":
                    shifted_var = op.operands[0]
                    if shifted_var.source is not None and shifted_var.source.op_type == "ADD":
                        # Only trace through if this ADD is a shift-ADD
                        # (second operand is a SHIFT_ constant), not a regular ADD
                        add_op = shifted_var.source
                        second_operand = add_op.operands[1]
                        is_shift_add = (
                            second_operand.min_bound == second_operand.max_bound
                            and second_operand.min_bound in self.constants
                            and self.constants[second_operand.min_bound].startswith("SHIFT_")
                        )
                        if is_shift_add:
                            src_name = add_op.operands[0].name
                        else:
                            src_name = shifted_var.name
                    else:
                        # No shift, REDUCE directly on the variable
                        src_name = shifted_var.name

            lines.append(f"    let {out_name}: ShiftedT = ({src_name} + SHIFT).try_into().unwrap();")
            lines.append(f"    let (_, {out_name}) = bounded_int_div_rem({out_name}, NZ_Q);")

        lines.append("")

        # Return statement
        if len(self.outputs) == 1:
            lines.append(f"    {self.outputs[0].name}")
        else:
            out_names = ", ".join(out.name for out in self.outputs)
            lines.append(f"    ({out_names})")

        lines.append("}")

        return "\n".join(lines)

    def _compile_felt252(self, func_name: str) -> str:
        """Compile circuit to Cairo code using felt252 mode.

        Args:
            func_name: Name of the generated function.

        Returns:
            Complete Cairo source code.
        """
        parts = [
            self._generate_felt252_imports(),
            self._generate_felt252_constants(),
            "",
            self._generate_felt252_function(func_name),
        ]
        return "\n".join(parts)

    def write(self, path: str) -> None:
        """Compile and write to file."""
        code = self.compile()
        with open(path, "w") as f:
            f.write(code)

        stats = self.stats()
        print(f"Written {stats['num_operations']} operations to {path}")
        print(f"Stats: {stats}")

    def stats(self) -> dict:
        """Return circuit statistics."""
        return {
            "num_variables": len(self.variables),
            "num_operations": len(self.operations),
            "num_reductions": sum(1 for op in self.operations if op.op_type == "REDUCE"),
            "num_types": len(self.bound_types),
            "max_bits": self.max_bits(),
        }

    def bounds_summary(self) -> dict:
        """Return summary details about current variable bounds."""
        variables = list(self.variables.values())
        if not variables:
            return {
                "num_variables": 0,
                "num_inputs": len(self.inputs),
                "num_outputs": len(self.outputs),
                "num_operations": len(self.operations),
                "max_abs": None,
                "max_range": None,
                "max_bits": 0,
                "max_abs_unreduced": None,
                "max_bits_unreduced": 0,
            }

        def abs_bound(var: BoundedIntVar) -> int:
            return max(abs(var.min_bound), abs(var.max_bound))

        def range_bound(var: BoundedIntVar) -> int:
            return var.max_bound - var.min_bound

        max_abs_var = max(variables, key=abs_bound)
        max_range_var = max(variables, key=range_bound)
        max_bits_var = max(variables, key=lambda v: v.bit_width)

        unreduced = [
            v for v in variables
            if not (v.source and v.source.op_type == "REDUCE")
        ]
        if unreduced:
            max_abs_unreduced_var = max(unreduced, key=abs_bound)
            max_bits_unreduced_var = max(unreduced, key=lambda v: v.bit_width)
        else:
            max_abs_unreduced_var = None
            max_bits_unreduced_var = None

        def var_info(var: BoundedIntVar | None) -> dict | None:
            if var is None:
                return None
            source = var.source.op_type if var.source else "INPUT"
            return {
                "name": var.name,
                "bounds": var.bounds,
                "bit_width": var.bit_width,
                "source": source,
            }

        return {
            "num_variables": len(variables),
            "num_inputs": len(self.inputs),
            "num_outputs": len(self.outputs),
            "num_operations": len(self.operations),
            "max_abs": var_info(max_abs_var),
            "max_range": var_info(max_range_var),
            "max_bits": var_info(max_bits_var),
            "max_abs_unreduced": var_info(max_abs_unreduced_var),
            "max_bits_unreduced": var_info(max_bits_unreduced_var),
        }

    def max_bits(self) -> int:
        """Return maximum bit-width across all variables."""
        if not self.variables:
            return 0
        return max(v.bit_width for v in self.variables.values())

    def print_summary(self) -> None:
        """Print a concise summary of bounds and extrema."""
        summary = self.bounds_summary()
        print(f"=== Circuit '{self.name}' Summary ===")
        print(
            f"Modulus: {self.modulus}, Auto-reduce threshold: {self.max_bound}"
        )
        print(
            "Counts:"
            f" vars={summary['num_variables']},"
            f" inputs={summary['num_inputs']},"
            f" outputs={summary['num_outputs']},"
            f" ops={summary['num_operations']}"
        )

        def format_var(label: str, info: dict | None) -> None:
            if info is None:
                print(f"{label}: (none)")
                return
            bounds = info["bounds"]
            print(
                f"{label}: {info['name']} {bounds} "
                f"({info['bit_width']} bits, {info['source']})"
            )

        format_var("Max abs bound", summary["max_abs"])
        format_var("Max range", summary["max_range"])
        format_var("Max bit width", summary["max_bits"])
        format_var("Max abs (unreduced)", summary["max_abs_unreduced"])
        format_var("Max bits (unreduced)", summary["max_bits_unreduced"])
        print()

    def print_bounds(self) -> None:
        """Print all current variable bounds."""
        print(f"=== Circuit '{self.name}' Bounds ===")
        print(f"Modulus: {self.modulus}, Auto-reduce threshold: {self.max_bound}")
        print()
        for var in self.variables.values():
            source = var.source.op_type if var.source else "INPUT"
            print(f"  {var.inspect()}  [{source}]")
