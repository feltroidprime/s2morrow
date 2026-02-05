# Felt252 Compilation Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `felt252` compilation mode to `BoundedIntCircuit` that generates native felt252 arithmetic instead of BoundedInt operations.

**Architecture:** The circuit DSL already tracks bounds for all intermediate values. We add a `mode` parameter to `compile()` that switches code generation: `bounded` mode produces the current BoundedInt types with helper impls, while `felt252` mode generates plain felt252 arithmetic with reduction only at outputs.

**Tech Stack:** Python circuit DSL (hydra/bounded_int_circuit/), Cairo output, pytest for testing

---

## Background Context

**Current bounded mode generates:**
- ~23,500 lines of type aliases (`BInt_min_max` for each unique bound pair)
- Helper trait impls for every operation combination (`AddHelper`, `SubHelper`, etc.)
- Typed operations: `let tmp_0: TypeX = add(operand1, operand2);`
- Total file size: ~41,600 lines for NTT-512

**Felt252 mode will generate:**
- Only reduction-related types (ShiftedT, RemT, QConst)
- One DivRemHelper impl
- Native operations: `let tmp_0 = operand1 + operand2;`
- Estimated file size: ~3,000 lines

**Key insight:** For NTT-512 with Q=12289, all intermediate bounds stay well under 2^128. Native felt252 arithmetic is safe and much simpler.

---

## Task 1: Add `_validate_felt252_mode()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Test: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Create test file `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
"""Tests for felt252 mode validation."""
import pytest
from hydra.bounded_int_circuit.circuit import BoundedIntCircuit


def test_validate_felt252_mode_within_bounds():
    """Circuit with bounds under 2^128 should pass validation."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y  # bounds: [0, 24576]
    circuit.output("z", z)

    # Should not raise
    circuit._validate_felt252_mode()


def test_validate_felt252_mode_exceeds_bounds():
    """Circuit with bounds >= 2^128 should fail validation."""
    circuit = BoundedIntCircuit(modulus=12289, max_bound=2**200)
    x = circuit.input("x", 0, 2**130)
    y = circuit.input("y", 0, 2**130)
    z = x + y  # bounds: [0, 2^131]
    circuit.output("z", z)

    with pytest.raises(ValueError, match="Bounds exceed 2\\^128"):
        circuit._validate_felt252_mode()


def test_validate_felt252_mode_negative_bounds():
    """Negative bounds should also be checked."""
    circuit = BoundedIntCircuit(modulus=12289, max_bound=2**200)
    x = circuit.input("x", -(2**130), 0)
    y = circuit.input("y", 0, 12288)
    z = x - y  # bounds: [-(2^130)-12288, 0]
    circuit.output("z", z)

    with pytest.raises(ValueError, match="Bounds exceed 2\\^128"):
        circuit._validate_felt252_mode()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_validate_felt252_mode'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method to `BoundedIntCircuit` class (after `compile()` method):

```python
def _validate_felt252_mode(self) -> None:
    """Validate that all bounds stay within felt252-safe range.

    Raises:
        ValueError: If any variable's bounds exceed 2^128.
    """
    limit = 2**128
    for var in self.variables.values():
        max_abs = max(abs(var.min_bound), abs(var.max_bound))
        if max_abs >= limit:
            raise ValueError(
                f"Bounds exceed 2^128, cannot use felt252 mode. "
                f"Variable '{var.name}' has bounds [{var.min_bound}, {var.max_bound}]"
            )
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v`
Expected: PASS (3 passed)

**Step 5: Commit**

```bash
git add tests/bounded_int_circuit/test_felt252_validation.py hydra/bounded_int_circuit/circuit.py
git commit -m "feat(circuit): add _validate_felt252_mode() method"
```

---

## Task 2: Add `_compute_shift()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
import math


def test_compute_shift_no_negatives():
    """No negatives means shift is 0."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y  # bounds: [0, 24576]
    circuit.output("z", z)

    assert circuit._compute_shift() == 0


def test_compute_shift_with_negatives():
    """Shift should be ceil(|min_bound| / Q) * Q."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y  # bounds: [-12288, 12288]
    circuit.output("z", z)

    # ceil(12288 / 12289) * 12289 = 1 * 12289 = 12289
    assert circuit._compute_shift() == 12289


def test_compute_shift_larger_negative():
    """Larger negatives need larger shift."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", -100000, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output("z", z)

    # ceil(100000 / 12289) * 12289 = 9 * 12289 = 110601
    expected = math.ceil(100000 / 12289) * 12289
    assert circuit._compute_shift() == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py::test_compute_shift_no_negatives -v`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_compute_shift'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method after `_validate_felt252_mode()`:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k compute_shift`
Expected: PASS (3 passed)

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _compute_shift() method for felt252 mode"
```

---

## Task 3: Add `_generate_felt252_imports()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
def test_generate_felt252_imports():
    """Imports should include BoundedInt machinery for output reduction."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output("out", x)

    imports = circuit._generate_felt252_imports()

    assert "use core::num::traits::Zero;" in imports
    assert "BoundedInt" in imports
    assert "upcast" in imports
    assert "bounded_int_div_rem" in imports
    assert "DivRemHelper" in imports
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py::test_generate_felt252_imports -v`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_generate_felt252_imports'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method:

```python
def _generate_felt252_imports(self) -> str:
    """Generate Cairo imports for felt252 mode."""
    return """// Auto-generated felt252 mode - DO NOT EDIT
use core::num::traits::Zero;
use corelib_imports::bounded_int::{
    BoundedInt, upcast, bounded_int_div_rem, DivRemHelper, UnitInt,
};
"""
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py::test_generate_felt252_imports -v`
Expected: PASS

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _generate_felt252_imports() method"
```

---

## Task 4: Add `_generate_felt252_constants()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
def test_generate_felt252_constants_basic():
    """Constants should be plain felt252 values."""
    circuit = BoundedIntCircuit(modulus=12289)
    circuit.constant("SQR1", 1479)
    circuit.constant("W4_0", 5765)
    x = circuit.input("x", 0, 12288)
    circuit.output("out", x)

    constants = circuit._generate_felt252_constants()

    assert "const SQR1: felt252 = 1479;" in constants
    assert "const W4_0: felt252 = 5765;" in constants


def test_generate_felt252_constants_reduction_machinery():
    """Should include SHIFT, Q types, and DivRemHelper."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y  # Creates negative bounds, so SHIFT > 0
    circuit.output("out", z)

    constants = circuit._generate_felt252_constants()

    # SHIFT constant
    assert "const SHIFT: felt252 = 12289;" in constants
    # Q constant type
    assert "type QConst = UnitInt<12289>;" in constants
    # NonZero Q
    assert "const nz_q: NonZero<QConst> = 12289;" in constants
    # ShiftedT type (shift + max_bound)
    assert "type ShiftedT = BoundedInt<0," in constants
    # RemT type
    assert "type RemT = BoundedInt<0, 12288>;" in constants
    # DivRemHelper impl
    assert "impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst>" in constants
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_constants`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_generate_felt252_constants'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method:

```python
def _generate_felt252_constants(self) -> str:
    """Generate Cairo constants and reduction types for felt252 mode."""
    lines = []

    # Generate plain felt252 constants
    for name, value in self.constants.items():
        lines.append(f"const {name}: felt252 = {value};")

    if lines:
        lines.append("")

    # Compute shift and max bounds for reduction types
    shift = self._compute_shift()
    max_bound = max(var.max_bound for var in self.variables.values())
    shifted_max = shift + max_bound

    # Reduction machinery
    lines.append(f"const SHIFT: felt252 = {shift};")
    lines.append(f"type QConst = UnitInt<{self.modulus}>;")
    lines.append(f"const nz_q: NonZero<QConst> = {self.modulus};")
    lines.append(f"type ShiftedT = BoundedInt<0, {shifted_max}>;")
    lines.append(f"type RemT = BoundedInt<0, {self.modulus - 1}>;")

    # DivRemHelper impl
    div_max = shifted_max // self.modulus
    lines.append("")
    lines.append("impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst> {")
    lines.append(f"    type DivT = BoundedInt<0, {div_max}>;")
    lines.append("    type RemT = RemT;")
    lines.append("}")

    return "\n".join(lines)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_constants`
Expected: PASS (2 passed)

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _generate_felt252_constants() method"
```

---

## Task 5: Add `_generate_felt252_op()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
from hydra.bounded_int_circuit.operation import Operation, OpType


def test_generate_felt252_op_add():
    """ADD should generate native + operator."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output("out", z)

    # Find the ADD operation
    add_op = next(op for op in circuit.operations if op.op_type == OpType.ADD)

    result = circuit._generate_felt252_op(add_op)
    assert result == "let tmp_0 = x + y;"


def test_generate_felt252_op_sub():
    """SUB should generate native - operator."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x - y
    circuit.output("out", z)

    sub_op = next(op for op in circuit.operations if op.op_type == OpType.SUB)

    result = circuit._generate_felt252_op(sub_op)
    assert result == "let tmp_0 = x - y;"


def test_generate_felt252_op_mul():
    """MUL should generate native * operator."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x * y
    circuit.output("out", z)

    mul_op = next(op for op in circuit.operations if op.op_type == OpType.MUL)

    result = circuit._generate_felt252_op(mul_op)
    assert result == "let tmp_0 = x * y;"


def test_generate_felt252_op_mul_constant():
    """MUL with constant should use constant name."""
    circuit = BoundedIntCircuit(modulus=12289)
    sqr1 = circuit.constant("SQR1", 1479)
    x = circuit.input("x", 0, 12288)
    z = x * sqr1
    circuit.output("out", z)

    mul_op = next(op for op in circuit.operations if op.op_type == OpType.MUL)

    result = circuit._generate_felt252_op(mul_op)
    assert result == "let tmp_0 = x * SQR1;"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_op`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_generate_felt252_op'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add import at top and method:

```python
# Add to imports at top of file
from hydra.bounded_int_circuit.operation import OpType
```

Then add the method:

```python
def _generate_felt252_op(self, op: "Operation") -> str:
    """Generate a single felt252 operation line.

    Args:
        op: The operation to generate.

    Returns:
        Cairo code line for this operation.
    """
    result_name = op.result.name

    if op.op_type == OpType.ADD:
        left = op.operands[0].name
        right = op.operands[1].name
        return f"let {result_name} = {left} + {right};"
    elif op.op_type == OpType.SUB:
        left = op.operands[0].name
        right = op.operands[1].name
        return f"let {result_name} = {left} - {right};"
    elif op.op_type == OpType.MUL:
        left = op.operands[0].name
        right = op.operands[1].name
        return f"let {result_name} = {left} * {right};"
    else:
        raise ValueError(f"Unsupported operation type for felt252 mode: {op.op_type}")
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_op`
Expected: PASS (4 passed)

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _generate_felt252_op() method"
```

---

## Task 6: Add `_generate_felt252_function()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
def test_generate_felt252_function_signature():
    """Function should use felt252 for all inputs and outputs."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output("out", z)

    func = circuit._generate_felt252_function("test_func")

    assert "pub fn test_func(x: felt252, y: felt252) -> felt252" in func


def test_generate_felt252_function_body():
    """Function body should have operations and output reduction."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output("out", z)

    func = circuit._generate_felt252_function("test_func")

    # Operation
    assert "let tmp_0 = x + y;" in func
    # Output reduction
    assert "let out: ShiftedT = (tmp_0 + SHIFT).try_into().unwrap();" in func
    assert "let (_, out_rem) = bounded_int_div_rem(out, nz_q);" in func
    assert "let out: felt252 = upcast(out_rem);" in func
    # Return
    assert "out" in func


def test_generate_felt252_function_multiple_outputs():
    """Multiple outputs should all be reduced and returned as tuple."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    circuit.output("r0", x + y)
    circuit.output("r1", x - y)

    func = circuit._generate_felt252_function("test_func")

    assert "-> (felt252, felt252)" in func
    assert "(r0, r1)" in func
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_function`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_generate_felt252_function'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method:

```python
def _generate_felt252_function(self, func_name: str) -> str:
    """Generate the main Cairo function for felt252 mode.

    Args:
        func_name: Name of the generated function.

    Returns:
        Complete Cairo function as a string.
    """
    lines = []

    # Collect inputs and outputs
    inputs = [v for v in self.variables.values() if v.is_input]
    outputs = list(self.outputs.items())

    # Function signature
    input_params = ", ".join(f"{v.name}: felt252" for v in inputs)
    if len(outputs) == 1:
        return_type = "felt252"
    else:
        return_type = "(" + ", ".join("felt252" for _ in outputs) + ")"

    lines.append(f"pub fn {func_name}({input_params}) -> {return_type} {{")

    # Generate operations (skip REDUCE operations in felt252 mode)
    for op in self.operations:
        if op.op_type == OpType.REDUCE:
            continue
        lines.append(f"    {self._generate_felt252_op(op)}")

    lines.append("")

    # Generate output reductions
    for out_name, out_var in outputs:
        src_name = out_var.name
        lines.append(f"    let {out_name}: ShiftedT = ({src_name} + SHIFT).try_into().unwrap();")
        lines.append(f"    let (_, {out_name}_rem) = bounded_int_div_rem({out_name}, nz_q);")
        lines.append(f"    let {out_name}: felt252 = upcast({out_name}_rem);")

    lines.append("")

    # Return statement
    if len(outputs) == 1:
        lines.append(f"    {outputs[0][0]}")
    else:
        out_names = ", ".join(name for name, _ in outputs)
        lines.append(f"    ({out_names})")

    lines.append("}")

    return "\n".join(lines)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k generate_felt252_function`
Expected: PASS (3 passed)

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _generate_felt252_function() method"
```

---

## Task 7: Add `_compile_felt252()` Method

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
def test_compile_felt252_combines_all_parts():
    """_compile_felt252 should combine imports, constants, and function."""
    circuit = BoundedIntCircuit(modulus=12289)
    circuit.constant("SQR1", 1479)
    x = circuit.input("x", 0, 12288)
    z = x * circuit.get_constant("SQR1")
    circuit.output("out", z)

    code = circuit._compile_felt252("test_func")

    # Imports
    assert "use corelib_imports::bounded_int" in code
    # Constants
    assert "const SQR1: felt252 = 1479;" in code
    assert "const SHIFT: felt252 =" in code
    # Function
    assert "pub fn test_func(" in code
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py::test_compile_felt252_combines_all_parts -v`
Expected: FAIL with `AttributeError: 'BoundedIntCircuit' object has no attribute '_compile_felt252'`

**Step 3: Write minimal implementation**

In `hydra/bounded_int_circuit/circuit.py`, add this method:

```python
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
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py::test_compile_felt252_combines_all_parts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add _compile_felt252() method"
```

---

## Task 8: Add `mode` Parameter to `compile()`

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_felt252_validation.py`

**Step 1: Write the failing test**

Add to `tests/bounded_int_circuit/test_felt252_validation.py`:

```python
def test_compile_mode_bounded_default():
    """Default mode should be 'bounded' (existing behavior)."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output("out", x)

    # Default should produce bounded int code
    code = circuit.compile("test_func")

    assert "AddHelper" in code or "type Zq" in code  # Bounded mode markers


def test_compile_mode_felt252():
    """mode='felt252' should produce felt252 arithmetic."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    y = circuit.input("y", 0, 12288)
    z = x + y
    circuit.output("out", z)

    code = circuit.compile("test_func", mode="felt252")

    # Should have native operations, not bounded
    assert "let tmp_0 = x + y;" in code
    assert "AddHelper" not in code


def test_compile_mode_invalid():
    """Invalid mode should raise ValueError."""
    circuit = BoundedIntCircuit(modulus=12289)
    x = circuit.input("x", 0, 12288)
    circuit.output("out", x)

    with pytest.raises(ValueError, match="Unknown compilation mode"):
        circuit.compile("test_func", mode="invalid")
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k "compile_mode"`
Expected: FAIL with `TypeError: compile() got an unexpected keyword argument 'mode'`

**Step 3: Modify compile() method**

In `hydra/bounded_int_circuit/circuit.py`, modify the `compile()` method signature and add mode dispatch:

Find the existing `compile()` method and modify it. The current signature is likely:
```python
def compile(self, func_name: str) -> str:
```

Change it to:
```python
def compile(self, func_name: str, mode: str = "bounded") -> str:
    """Compile the circuit to Cairo code.

    Args:
        func_name: Name of the generated function.
        mode: Compilation mode - "bounded" (default) or "felt252".

    Returns:
        Complete Cairo source code.

    Raises:
        ValueError: If mode is unknown or felt252 mode validation fails.
    """
    if mode == "felt252":
        self._validate_felt252_mode()
        return self._compile_felt252(func_name)
    elif mode == "bounded":
        # Existing bounded compilation logic
        return self._compile_bounded(func_name)
    else:
        raise ValueError(f"Unknown compilation mode: {mode}. Use 'bounded' or 'felt252'.")
```

**Important:** You need to rename the existing compile body to `_compile_bounded()`. Move all the existing compile() logic into a new `_compile_bounded()` method, then have compile() call it.

**Step 4: Run test to verify it passes**

Run: `pytest tests/bounded_int_circuit/test_felt252_validation.py -v -k "compile_mode"`
Expected: PASS (3 passed)

**Step 5: Run all tests to ensure no regressions**

Run: `pytest tests/bounded_int_circuit/ -v`
Expected: All tests pass

**Step 6: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_felt252_validation.py
git commit -m "feat(circuit): add mode parameter to compile() method"
```

---

## Task 9: Update `ntt.py` to Support felt252 Mode

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Test: `tests/compilable_circuits/test_ntt_felt252.py`

**Step 1: Write the failing test**

Create test file `tests/compilable_circuits/test_ntt_felt252.py`:

```python
"""Tests for NTT felt252 mode generation."""
import pytest
from hydra.compilable_circuits.ntt import NttCircuitGenerator


def test_ntt_generate_felt252_mode():
    """NTT generator should support felt252 mode."""
    gen = NttCircuitGenerator(n=4, q=12289)  # Small N for fast test

    code = gen.generate(mode="felt252")

    # Should have native felt252 arithmetic
    assert "let tmp_" in code
    # Should NOT have BoundedInt helper traits
    assert "AddHelper" not in code
    assert "SubHelper" not in code
    assert "MulHelper" not in code


def test_ntt_generate_full_felt252_mode():
    """Full NTT with wrapper should use Array<felt252>."""
    gen = NttCircuitGenerator(n=4, q=12289)

    code = gen.generate_full(mode="felt252")

    # Wrapper should use felt252 arrays
    assert "Array<felt252>" in code
    # Inner function should exist
    assert "ntt_4_inner" in code
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt_felt252.py -v`
Expected: FAIL with `TypeError: generate() got an unexpected keyword argument 'mode'`

**Step 3: Modify ntt.py**

In `hydra/compilable_circuits/ntt.py`, update `generate()` and `generate_full()`:

```python
def generate(self, mode: str = "bounded") -> str:
    """Generate the inner NTT function.

    Args:
        mode: Compilation mode - "bounded" or "felt252".

    Returns:
        Cairo source code for the inner function.
    """
    return self.circuit.compile(f"ntt_{self.n}_inner", mode=mode)


def generate_full(self, mode: str = "bounded") -> str:
    """Generate complete NTT module with wrapper function.

    Args:
        mode: Compilation mode - "bounded" or "felt252".

    Returns:
        Complete Cairo source code.
    """
    inner = self.generate(mode=mode)

    # Determine array type based on mode
    if mode == "felt252":
        elem_type = "felt252"
    else:
        elem_type = "Zq"

    wrapper = self._generate_wrapper(elem_type)

    return inner + "\n\n" + wrapper
```

Also update or add `_generate_wrapper()` to accept the element type:

```python
def _generate_wrapper(self, elem_type: str) -> str:
    """Generate the public wrapper function.

    Args:
        elem_type: Element type for arrays ("Zq" or "felt252").

    Returns:
        Cairo wrapper function code.
    """
    n = self.n
    inputs = ", ".join(f"f{i}" for i in range(n))
    outputs = ", ".join(f"r{i}" for i in range(n))

    return f"""pub fn ntt_{n}(mut f: Array<{elem_type}>) -> Array<{elem_type}> {{
    let mut f_span = f.span();
    let boxed = f_span.multi_pop_front::<{n}>().expect('expected {n} elements');
    let [{inputs}] = boxed.unbox();

    let ({outputs}) = ntt_{n}_inner({inputs});

    array![{outputs}]
}}"""
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/compilable_circuits/test_ntt_felt252.py -v`
Expected: PASS (2 passed)

**Step 5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt_felt252.py
git commit -m "feat(ntt): add felt252 mode support to NTT generator"
```

---

## Task 10: Update `regenerate.py` CLI

**Files:**
- Modify: `hydra/compilable_circuits/regenerate.py`

**Step 1: Read current regenerate.py**

Run: Read the current `hydra/compilable_circuits/regenerate.py` to understand its structure.

**Step 2: Add `--mode` argument**

Modify the argument parser to add `--mode`:

```python
parser.add_argument(
    "--mode",
    choices=["bounded", "felt252"],
    default="bounded",
    help="Compilation mode: 'bounded' for BoundedInt types, 'felt252' for native arithmetic"
)
```

**Step 3: Update output path based on mode**

Modify the output path logic:

```python
if args.mode == "felt252":
    output_path = "packages/falcon/src/ntt_felt252.cairo"
else:
    output_path = "packages/falcon/src/ntt_bounded_int.cairo"
```

**Step 4: Pass mode to generator**

Update the generation call:

```python
code = gen.generate_full(mode=args.mode)
```

**Step 5: Test manually**

Run: `python -m hydra.compilable_circuits.regenerate ntt --n 4 --mode felt252`
Expected: Should generate `packages/falcon/src/ntt_felt252.cairo`

**Step 6: Commit**

```bash
git add hydra/compilable_circuits/regenerate.py
git commit -m "feat(regenerate): add --mode flag for felt252 compilation"
```

---

## Task 11: Update Makefile

**Files:**
- Modify: `Makefile`

**Step 1: Read current Makefile**

Find the `regenerate-ntt` target.

**Step 2: Update target to generate both modes**

```makefile
regenerate-ntt:
	python -m hydra.compilable_circuits.regenerate ntt --n 512 --mode bounded
	python -m hydra.compilable_circuits.regenerate ntt --n 512 --mode felt252
```

**Step 3: Test**

Run: `make regenerate-ntt`
Expected: Both `ntt_bounded_int.cairo` and `ntt_felt252.cairo` are generated.

**Step 4: Commit**

```bash
git add Makefile
git commit -m "build: update regenerate-ntt to generate both bounded and felt252 modes"
```

---

## Task 12: Generate NTT-512 in felt252 Mode

**Files:**
- Create: `packages/falcon/src/ntt_felt252.cairo`

**Step 1: Generate the file**

Run: `python -m hydra.compilable_circuits.regenerate ntt --n 512 --mode felt252`

**Step 2: Verify it compiles**

Run: `cd packages/falcon && scarb build`
Expected: Build succeeds

**Step 3: Commit generated file**

```bash
git add packages/falcon/src/ntt_felt252.cairo
git commit -m "feat(falcon): add generated NTT-512 in felt252 mode"
```

---

## Task 13: Add lib.cairo Export for felt252 NTT

**Files:**
- Modify: `packages/falcon/src/lib.cairo`

**Step 1: Read current lib.cairo**

Find how `ntt_bounded_int` is exported.

**Step 2: Add felt252 export**

Add:
```cairo
pub mod ntt_felt252;
```

**Step 3: Verify it compiles**

Run: `cd packages/falcon && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/falcon/src/lib.cairo
git commit -m "feat(falcon): export ntt_felt252 module"
```

---

## Task 14: Integration Test - Compare Outputs

**Files:**
- Create: `tests/integration/test_ntt_modes_match.py`

**Step 1: Write integration test**

This test verifies both NTT implementations produce identical results. Since we can't run Cairo directly from Python, this should be a Cairo test in the falcon package.

Create `packages/falcon/tests/test_ntt_modes.cairo`:

```cairo
use falcon::ntt_bounded_int::ntt_512 as ntt_bounded;
use falcon::ntt_felt252::ntt_512 as ntt_felt;

#[test]
fn test_ntt_modes_produce_same_output() {
    // Create test input
    let mut input_bounded: Array<falcon::ntt_bounded_int::Zq> = array![];
    let mut input_felt: Array<felt252> = array![];

    // Fill with test values (0, 1, 2, ..., 511)
    let mut i: u32 = 0;
    while i < 512 {
        input_bounded.append(i.into());
        input_felt.append(i.into());
        i += 1;
    };

    let result_bounded = ntt_bounded(input_bounded);
    let result_felt = ntt_felt(input_felt);

    // Compare results
    let mut j: u32 = 0;
    while j < 512 {
        let rb: felt252 = (*result_bounded.at(j)).into();
        let rf: felt252 = *result_felt.at(j);
        assert!(rb == rf, "Mismatch at index {}", j);
        j += 1;
    };
}
```

**Step 2: Run test**

Run: `cd packages/falcon && snforge test test_ntt_modes_produce_same_output`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/falcon/tests/test_ntt_modes.cairo
git commit -m "test(falcon): add integration test comparing NTT modes"
```

---

## Task 15: Final Verification and Cleanup

**Step 1: Run all Python tests**

Run: `pytest tests/ -v`
Expected: All tests pass

**Step 2: Run all Cairo tests**

Run: `cd packages/falcon && snforge test`
Expected: All tests pass

**Step 3: Verify both NTT files exist and compile**

Run: `scarb build`
Expected: Build succeeds

**Step 4: Review file sizes**

Run: `wc -l packages/falcon/src/ntt_bounded_int.cairo packages/falcon/src/ntt_felt252.cairo`
Expected: felt252 version is significantly smaller (~3,000 lines vs ~41,000 lines)

**Step 5: Final commit if any cleanup needed**

```bash
git status
# If any uncommitted changes, commit them
```

---

## Summary

This plan adds felt252 compilation mode through 15 incremental tasks:

1. **Tasks 1-7**: Core `BoundedIntCircuit` methods for felt252 generation
2. **Task 8**: Wire up `mode` parameter to `compile()`
3. **Tasks 9-10**: Update NTT generator and CLI
4. **Task 11**: Update Makefile
5. **Tasks 12-13**: Generate and export felt252 NTT
6. **Task 14**: Integration test for correctness
7. **Task 15**: Final verification

Each task follows TDD: write failing test, implement, verify, commit.
