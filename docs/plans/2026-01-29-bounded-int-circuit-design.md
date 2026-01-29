# BoundedIntCircuit: Python to Cairo Compiler for Bounded Integers

## Overview

A Python-based compiler that records arithmetic operations on bounded integers and generates optimized Cairo code. Inspired by [Garaga's ModuloCircuit](https://github.com/VolodymyrBg/garaga/blob/main/hydra/garaga/modulo_circuit.py), but targeting Cairo's `BoundedInt` type system instead of modular arithmetic builtins.

**Goal**: Compile fully unrolled computations (e.g., Falcon-512 signature verification) into a single Cairo function with thousands of operations.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Abstraction level | Circuit-level (complete functions, not primitives) |
| Bound propagation | Explicit reduction points + auto-reduce at threshold |
| Auto-reduce threshold | Configurable per-circuit, hard max 2^128 |
| API style | Operator overloading (`a + b`) + explicit methods (`.reduce()`) |
| Constants | Hybrid: named constants + auto-naming fallback |
| I/O types | Full BoundedInt (no primitive conversion at boundaries) |
| Code structure | Single file, all-in-one |
| Array handling | Fully unrolled scalar variables |

## Reference

Cairo corelib BoundedInt tests (including negative bounds):
https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268

## Core Data Model

### BoundedIntVar

Represents a variable with tracked bounds:

```python
@dataclass
class BoundedIntVar:
    """A variable in the circuit with tracked bounds."""
    circuit: 'BoundedIntCircuit'
    name: str              # e.g., "s1_0", "tmp_42"
    min_bound: int         # Known minimum value (can be negative)
    max_bound: int         # Known maximum value
    source: 'Operation'    # What created this variable

    @property
    def bounds(self) -> tuple[int, int]:
        return (self.min_bound, self.max_bound)

    @property
    def bit_width(self) -> int:
        return max(abs(self.min_bound), abs(self.max_bound)).bit_length()

    # Operator overloading
    def __add__(self, other) -> 'BoundedIntVar':
        return self.circuit.add(self, other)

    def __sub__(self, other) -> 'BoundedIntVar':
        return self.circuit.sub(self, other)

    def __mul__(self, other) -> 'BoundedIntVar':
        return self.circuit.mul(self, other)

    def __floordiv__(self, other) -> 'BoundedIntVar':
        return self.circuit.div(self, other)

    def __mod__(self, other) -> 'BoundedIntVar':
        return self.circuit.mod(self, other)

    def div_rem(self, divisor) -> tuple['BoundedIntVar', 'BoundedIntVar']:
        return self.circuit.div_rem(self, divisor)

    def reduce(self, modulus: int = None) -> 'BoundedIntVar':
        return self.circuit.reduce(self, modulus)

    def inspect(self) -> str:
        return f"{self.name}: BoundedInt<{self.min_bound}, {self.max_bound}>"

    def __repr__(self) -> str:
        return self.inspect()
```

### Operation

Records a single operation in the circuit trace:

```python
@dataclass
class Operation:
    op_type: str           # "ADD", "SUB", "MUL", "DIV", "REM", "REDUCE"
    operands: list[BoundedIntVar]
    result: BoundedIntVar
    extra: dict = None     # Additional data (e.g., q_bounds for REDUCE)
    comment: str = None    # Optional annotation for generated code
```

## BoundedIntCircuit Class

### Constructor

```python
class BoundedIntCircuit:
    def __init__(
        self,
        name: str,                    # Function name in generated Cairo
        modulus: int,                 # Primary modulus (e.g., 12289)
        max_bound: int = 2**64,       # Auto-reduce threshold
    ):
        self.name = name
        self.modulus = modulus
        self.max_bound = min(max_bound, 2**128)  # Hard cap

        # Tracking
        self.variables: dict[str, BoundedIntVar] = {}
        self.operations: list[Operation] = []
        self.inputs: list[BoundedIntVar] = []
        self.outputs: list[BoundedIntVar] = []
        self.constants: dict[int, str] = {}  # value -> name mapping

        # Type registry (for deduplication)
        self.bound_types: set[tuple[int, int]] = set()
        self.helper_impls: set[str] = set()
```

### Input/Output/Constant Registration

```python
def input(self, name: str, min_val: int, max_val: int) -> BoundedIntVar:
    """Create an input variable with known bounds."""
    ...

def output(self, var: BoundedIntVar, name: str = None) -> None:
    """Mark a variable as circuit output."""
    ...

def register_constant(self, value: int, name: str) -> None:
    """Register a named constant (e.g., register_constant(12289, "Q"))."""
    ...

def constant(self, value: int, name: str = None) -> BoundedIntVar:
    """Create a constant variable."""
    ...
```

### Arithmetic Operations

All operations auto-reduce if bounds exceed `±max_bound`:

```python
def _create_and_maybe_reduce(self, op_type: str, operands: list,
                              min_val: int, max_val: int,
                              **extra) -> BoundedIntVar:
    """Create operation and auto-reduce if bounds exceed threshold."""
    var = self._create_op(op_type, operands, min_val, max_val, **extra)
    if var.max_bound > self.max_bound or var.min_bound < -self.max_bound:
        return self.reduce(var)
    return var

def add(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
    min_val = a.min_bound + b.min_bound
    max_val = a.max_bound + b.max_bound
    return self._create_and_maybe_reduce("ADD", [a, b], min_val, max_val)

def sub(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
    min_val = a.min_bound - b.max_bound  # Can be negative
    max_val = a.max_bound - b.min_bound
    return self._create_and_maybe_reduce("SUB", [a, b], min_val, max_val)

def mul(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
    # For signed multiplication, consider all corner combinations
    corners = [
        a.min_bound * b.min_bound,
        a.min_bound * b.max_bound,
        a.max_bound * b.min_bound,
        a.max_bound * b.max_bound,
    ]
    return self._create_and_maybe_reduce("MUL", [a, b], min(corners), max(corners))
```

### Division and Modulo

```python
def div_rem(self, a: BoundedIntVar, b: BoundedIntVar | int) -> tuple[BoundedIntVar, BoundedIntVar]:
    """Division with remainder. Returns (quotient, remainder)."""
    if isinstance(b, int):
        b = self.constant(b)

    # Quotient bounds
    corners = [
        a.min_bound // b.min_bound if b.min_bound != 0 else 0,
        a.min_bound // b.max_bound,
        a.max_bound // b.min_bound if b.min_bound != 0 else 0,
        a.max_bound // b.max_bound,
    ]
    q_min, q_max = min(corners), max(corners)

    # Remainder bounds: [0, max(|b|) - 1]
    r_max = max(abs(b.min_bound), abs(b.max_bound)) - 1

    quotient = self._create_op("DIV", [a, b], q_min, q_max)
    remainder = self._create_op("REM", [a, b], 0, r_max)

    self._register_divrem_pair(quotient, remainder, a, b)
    return quotient, remainder

def div(self, a: BoundedIntVar, b: BoundedIntVar | int) -> BoundedIntVar:
    q, _ = self.div_rem(a, b)
    return q

def mod(self, a: BoundedIntVar, b: BoundedIntVar | int) -> BoundedIntVar:
    _, r = self.div_rem(a, b)
    return r
```

### Reduce Operation

```python
def reduce(self, var: BoundedIntVar, modulus: int = None) -> BoundedIntVar:
    """Explicit modular reduction. Resets bounds to [0, modulus-1]."""
    modulus = modulus or self.modulus

    # Compute quotient bounds for DivRemHelper
    q_min = var.min_bound // modulus
    q_max = var.max_bound // modulus

    # Handle negative dividends
    if var.min_bound < 0:
        q_min = -((-var.min_bound) // modulus + 1)

    result = self._create_op(
        "REDUCE",
        [var],
        min_val=0,
        max_val=modulus - 1,
        extra={"q_bounds": (q_min, q_max)}
    )

    self._register_divrem_helper(var.bounds, modulus, (q_min, q_max))
    return result
```

### Bound Inspection and Debugging

```python
def print_bounds(self) -> None:
    """Print all current variable bounds."""
    print(f"=== Circuit '{self.name}' Bounds ===")
    print(f"Modulus: {self.modulus}, Auto-reduce threshold: {self.max_bound}")
    print()
    for var in self.variables.values():
        source = var.source.op_type if var.source else "INPUT"
        print(f"  {var.inspect()}  [{source}]")

def stats(self) -> dict:
    """Return circuit statistics."""
    return {
        "num_variables": len(self.variables),
        "num_operations": len(self.operations),
        "num_reductions": sum(1 for op in self.operations if op.op_type == "REDUCE"),
        "num_types": len(self.bound_types),
        "max_bits": self.max_bits(),
    }
```

## Code Generation

### Type Definitions

```python
def _generate_types(self) -> str:
    """Generate all BoundedInt type aliases."""
    lines = []

    for min_b, max_b in sorted(self.bound_types):
        type_name = self._type_name(min_b, max_b)
        lines.append(f"type {type_name} = BoundedInt<{min_b}, {max_b}>;")

    for value, name in self.constants.items():
        lines.append(f"type {name}Const = UnitInt<{value}>;")

    return "\n".join(lines)

def _type_name(self, min_b: int, max_b: int) -> str:
    """Generate readable type name for bounds."""
    if min_b == max_b and min_b in self.constants:
        return f"{self.constants[min_b]}Const"
    if min_b == 0 and max_b == self.modulus - 1:
        return "Zq"
    if min_b < 0:
        return f"BInt_n{abs(min_b)}_{max_b}"
    return f"BInt_{min_b}_{max_b}"
```

### Helper Impls

```python
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
        elif op.op_type in ("REDUCE", "DIV", "REM"):
            lines.append(self._gen_divrem_helper(op))

    return "\n\n".join(lines)
```

### Function Body

```python
def _generate_function(self) -> str:
    """Generate the main circuit function."""
    params = ", ".join(
        f"{inp.name}: {self._type_name(*inp.bounds)}"
        for inp in self.inputs
    )
    returns = ", ".join(
        f"{self._type_name(*out.bounds)}"
        for out in self.outputs
    )

    body_lines = []
    for op in self.operations:
        line = self._generate_op(op)
        if op.comment:
            line += f"  // {op.comment}"
        body_lines.append(line)

    output_names = ", ".join(out.name for out in self.outputs)
    body_lines.append(f"({output_names})")

    body = "\n    ".join(body_lines)
    return f"""pub fn {self.name}({params}) -> ({returns}) {{
    {body}
}}"""

def _generate_op(self, op: Operation) -> str:
    """Generate Cairo code for a single operation."""
    r = op.result.name
    r_type = self._type_name(*op.result.bounds)

    if op.op_type == "ADD":
        a, b = op.operands
        return f"let {r}: {r_type} = add({a.name}, {b.name});"
    elif op.op_type == "SUB":
        a, b = op.operands
        return f"let {r}: {r_type} = sub({a.name}, {b.name});"
    elif op.op_type == "MUL":
        a, b = op.operands
        return f"let {r}: {r_type} = mul({a.name}, {b.name});"
    elif op.op_type == "REDUCE":
        a = op.operands[0]
        q_name = f"_{r}_q"
        return f"let ({q_name}, {r}): (_, {r_type}) = bounded_int_div_rem({a.name}, nz_q);"
```

### Complete Compile Method

```python
def compile(self) -> str:
    """Generate complete Cairo source file."""
    parts = [
        self._generate_imports(),
        self._generate_types(),
        self._generate_helper_impls(),
        self._generate_constants(),
        self._generate_function(),
    ]
    return "\n\n".join(parts)

def _generate_imports(self) -> str:
    return """use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};"""

def _generate_constants(self) -> str:
    lines = []
    for value, name in self.constants.items():
        lines.append(f"const nz_{name.lower()}: NonZero<{name}Const> = {value};")
    return "\n".join(lines)

def write(self, path: str) -> None:
    """Compile and write to file."""
    code = self.compile()
    with open(path, "w") as f:
        f.write(code)
    print(f"Written {len(self.operations)} operations to {path}")
    print(self.stats())
```

## Usage Example

```python
from bounded_int_circuit import BoundedIntCircuit

# Create circuit for Falcon modular arithmetic
circuit = BoundedIntCircuit(
    name="ntt_butterfly",
    modulus=12289,
    max_bound=2**64,
)

# Register named constants
circuit.register_constant(12289, "Q")

# Define inputs
a = circuit.input("a", 0, 12288)
b = circuit.input("b", 0, 12288)
w = circuit.input("w", 0, 12288)

# NTT butterfly operations
sum_ab = a + b           # BoundedInt<0, 24576>
diff_ab = a - b          # BoundedInt<-12288, 12288>
prod = diff_ab * w       # BoundedInt<-150994944, 150994944>

# Debug: inspect bounds at any point
print(sum_ab.inspect())
print(prod.inspect())
circuit.print_bounds()

# Reduce to get outputs
r0 = sum_ab.reduce()
r1 = prod.reduce()

# Mark outputs
circuit.output(r0, "r0")
circuit.output(r1, "r1")

# Generate and write Cairo code
circuit.write("src/generated_ntt.cairo")
```

### Generated Output

```cairo
use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};

type Zq = BoundedInt<0, 12288>;
type BInt_0_24576 = BoundedInt<0, 24576>;
type BInt_n12288_12288 = BoundedInt<-12288, 12288>;
type BInt_n150994944_150994944 = BoundedInt<-150994944, 150994944>;
type QConst = UnitInt<12289>;

impl Add_Zq_Zq of AddHelper<Zq, Zq> {
    type Result = BInt_0_24576;
}

impl Sub_Zq_Zq of SubHelper<Zq, Zq> {
    type Result = BInt_n12288_12288;
}

impl Mul_BInt_n12288_12288_Zq of MulHelper<BInt_n12288_12288, Zq> {
    type Result = BInt_n150994944_150994944;
}

impl DivRem_BInt_0_24576_QConst of DivRemHelper<BInt_0_24576, QConst> {
    type DivT = BInt_0_1;
    type RemT = Zq;
}

impl DivRem_BInt_n150994944_150994944_QConst of DivRemHelper<BInt_n150994944_150994944, QConst> {
    type DivT = BInt_n12288_12288;
    type RemT = Zq;
}

const nz_q: NonZero<QConst> = 12289;

pub fn ntt_butterfly(a: Zq, b: Zq, w: Zq) -> (Zq, Zq) {
    let sum_ab: BInt_0_24576 = add(a, b);
    let diff_ab: BInt_n12288_12288 = sub(a, b);
    let prod: BInt_n150994944_150994944 = mul(diff_ab, w);
    let (_r0_q, r0): (_, Zq) = bounded_int_div_rem(sum_ab, nz_q);
    let (_r1_q, r1): (_, Zq) = bounded_int_div_rem(prod, nz_q);
    (r0, r1)
}
```

## File Structure

```
hydra/
└── bounded_int_circuit/
    ├── __init__.py
    ├── circuit.py          # BoundedIntCircuit class
    ├── variable.py         # BoundedIntVar class
    ├── operation.py        # Operation dataclass
    └── codegen.py          # Cairo code generation helpers
```

## Future Considerations

- **Fusion detection**: Automatically detect patterns like `a + b * c` that could be fused
- **Dead code elimination**: Remove unused intermediate variables
- **Constant folding**: Evaluate constant expressions at compile time
- **Multiple functions**: Support generating multiple related functions in one file
