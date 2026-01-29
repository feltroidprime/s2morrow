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
            return self.reduce(var)
        return var

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

            # Add shift to make non-negative
            shifted = self.add(var, shift_const)
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
        from .codegen import type_name
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
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = add({a_name}, {b_name});"

        elif op.op_type == "SUB":
            a, b = op.operands
            a_name = a.name
            b_name = b.name
            if a.min_bound == a.max_bound and a.min_bound in self.constants:
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = sub({a_name}, {b_name});"

        elif op.op_type == "MUL":
            a, b = op.operands
            a_name = a.name
            b_name = b.name
            if a.min_bound == a.max_bound and a.min_bound in self.constants:
                a_name = f"{self.constants[a.min_bound].lower()}_const"
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
                b_name = f"{self.constants[b.min_bound].lower()}_const"
            return f"let {r}: {r_type} = mul({a_name}, {b_name});"

        elif op.op_type == "REDUCE":
            a = op.operands[0]
            modulus = op.extra.get("modulus", self.modulus)
            if modulus in self.constants:
                nz_name = f"nz_{self.constants[modulus].lower()}"
            else:
                nz_name = f"nz_{modulus}"
            q_name = f"_{r}_q"
            return f"let ({q_name}, {r}): (_, {r_type}) = bounded_int_div_rem({a.name}, {nz_name});"

        elif op.op_type == "DIV":
            a, b = op.operands
            # Check if divisor is a registered constant
            if b.min_bound == b.max_bound and b.min_bound in self.constants:
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
        """Generate constant definitions (both NonZero and regular)."""
        lines = []
        for value, name in sorted(self.constants.items()):
            # Regular constant for addition operations
            lines.append(f"const {name.lower()}_const: {name}Const = {value};")
            # NonZero variant for div_rem operations
            lines.append(f"const nz_{name.lower()}: NonZero<{name}Const> = {value};")
        return "\n".join(lines)

    def compile(self) -> str:
        """Generate complete Cairo source file."""
        parts = [
            self._generate_imports(),
            self._generate_types(),
            self._generate_helper_impls(),
            self._generate_constants(),
            self._generate_function(),
        ]

        # Filter out empty parts
        parts = [p for p in parts if p.strip()]

        return "\n\n".join(parts)

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

    def max_bits(self) -> int:
        """Return maximum bit-width across all variables."""
        if not self.variables:
            return 0
        return max(v.bit_width for v in self.variables.values())

    def print_bounds(self) -> None:
        """Print all current variable bounds."""
        print(f"=== Circuit '{self.name}' Bounds ===")
        print(f"Modulus: {self.modulus}, Auto-reduce threshold: {self.max_bound}")
        print()
        for var in self.variables.values():
            source = var.source.op_type if var.source else "INPUT"
            print(f"  {var.inspect()}  [{source}]")
