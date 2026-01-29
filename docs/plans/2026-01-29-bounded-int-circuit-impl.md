# BoundedIntCircuit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python compiler that generates Cairo code for bounded integer arithmetic, validated by compiling with scarb.

**Architecture:** Python classes (BoundedIntVar, Operation, BoundedIntCircuit) record operations and track bounds, then generate Cairo source code. Tests create temporary scarb packages and verify compilation succeeds.

**Tech Stack:** Python 3.10+, pytest, scarb 2.14.0, tempfile for test packages

---

## File Structure

```
hydra/
└── bounded_int_circuit/
    ├── __init__.py
    ├── variable.py         # BoundedIntVar dataclass
    ├── operation.py        # Operation dataclass
    ├── circuit.py          # BoundedIntCircuit main class
    └── codegen.py          # Cairo code generation

tests/
└── bounded_int_circuit/
    ├── conftest.py         # pytest fixtures (scarb package generator)
    ├── test_variable.py    # BoundedIntVar unit tests
    ├── test_bounds.py      # Bound propagation tests
    ├── test_codegen.py     # Code generation tests
    └── test_compilation.py # Full scarb compilation tests
```

---

## Task 1: Project Setup

**Files:**
- Create: `hydra/bounded_int_circuit/__init__.py`
- Create: `hydra/bounded_int_circuit/variable.py`
- Create: `hydra/bounded_int_circuit/operation.py`
- Create: `tests/bounded_int_circuit/__init__.py`
- Create: `tests/bounded_int_circuit/conftest.py`

**Step 1: Create directory structure**

```bash
mkdir -p hydra/bounded_int_circuit tests/bounded_int_circuit
```

**Step 2: Create operation.py with Operation dataclass**

```python
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
```

**Step 3: Create variable.py with BoundedIntVar dataclass**

```python
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
```

**Step 4: Create __init__.py**

```python
# hydra/bounded_int_circuit/__init__.py
from .variable import BoundedIntVar
from .operation import Operation

__all__ = ["BoundedIntVar", "Operation"]
```

**Step 5: Create test conftest.py with scarb fixture**

```python
# tests/bounded_int_circuit/conftest.py
import pytest
import subprocess
import tempfile
import shutil
from pathlib import Path


@pytest.fixture
def scarb_package():
    """Factory fixture that creates a temporary scarb package and compiles Cairo code."""
    created_dirs = []

    def _create_and_compile(cairo_code: str, package_name: str = "test_circuit") -> tuple[bool, str]:
        """
        Create a scarb package with the given Cairo code and attempt to compile.

        Returns:
            (success: bool, output: str)
        """
        tmpdir = Path(tempfile.mkdtemp(prefix=f"bounded_int_test_{package_name}_"))
        created_dirs.append(tmpdir)

        # Create Scarb.toml
        scarb_toml = f"""[package]
name = "{package_name}"
version = "0.1.0"
edition = "2024_07"

[dependencies]
corelib_imports = "0.1.2"
"""
        (tmpdir / "Scarb.toml").write_text(scarb_toml)

        # Create src directory and lib.cairo
        src_dir = tmpdir / "src"
        src_dir.mkdir()
        (src_dir / "lib.cairo").write_text(cairo_code)

        # Run scarb build
        result = subprocess.run(
            ["scarb", "build"],
            cwd=tmpdir,
            capture_output=True,
            text=True,
            timeout=60,
        )

        success = result.returncode == 0
        output = result.stdout + result.stderr

        return success, output

    yield _create_and_compile

    # Cleanup
    for d in created_dirs:
        shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def assert_compiles(scarb_package):
    """Fixture that asserts Cairo code compiles successfully."""
    def _assert(cairo_code: str, package_name: str = "test_circuit"):
        success, output = scarb_package(cairo_code, package_name)
        assert success, f"Compilation failed:\n{output}\n\nCode:\n{cairo_code}"
    return _assert


@pytest.fixture
def assert_compile_fails(scarb_package):
    """Fixture that asserts Cairo code fails to compile."""
    def _assert(cairo_code: str, package_name: str = "test_circuit"):
        success, output = scarb_package(cairo_code, package_name)
        assert not success, f"Expected compilation to fail but it succeeded:\n{cairo_code}"
        return output
    return _assert
```

**Step 6: Create empty test __init__.py**

```python
# tests/bounded_int_circuit/__init__.py
```

**Step 7: Verify setup with a basic test**

Create `tests/bounded_int_circuit/test_setup.py`:

```python
# tests/bounded_int_circuit/test_setup.py
def test_imports():
    from hydra.bounded_int_circuit import BoundedIntVar, Operation
    assert BoundedIntVar is not None
    assert Operation is not None


def test_scarb_fixture_compiles_valid_code(assert_compiles):
    """Verify the scarb fixture works with valid Cairo code."""
    code = """
fn main() -> u32 {
    42
}
"""
    assert_compiles(code, "test_valid")


def test_scarb_fixture_rejects_invalid_code(assert_compile_fails):
    """Verify the scarb fixture catches invalid Cairo code."""
    code = """
fn main() -> u32 {
    this_is_not_valid_cairo!!!
}
"""
    assert_compile_fails(code, "test_invalid")
```

**Step 8: Run tests to verify setup**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_setup.py -v
```

Expected: All 3 tests pass

**Step 9: Commit**

```bash
git add hydra/ tests/bounded_int_circuit/
git commit -m "feat: scaffold bounded_int_circuit package with test fixtures"
```

---

## Task 2: BoundedIntCircuit Core - Input and Variable Creation

**Files:**
- Create: `hydra/bounded_int_circuit/circuit.py`
- Modify: `hydra/bounded_int_circuit/__init__.py`
- Create: `tests/bounded_int_circuit/test_variable.py`

**Step 1: Write failing tests for input creation**

```python
# tests/bounded_int_circuit/test_variable.py
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit, BoundedIntVar


class TestInputCreation:
    def test_create_input_with_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)

        assert a.name == "a"
        assert a.min_bound == 0
        assert a.max_bound == 12288
        assert a.bounds == (0, 12288)

    def test_create_input_with_negative_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", -128, 127)

        assert a.min_bound == -128
        assert a.max_bound == 127

    def test_input_tracked_in_circuit(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        assert len(circuit.inputs) == 2
        assert circuit.inputs[0] is a
        assert circuit.inputs[1] is b

    def test_input_registered_in_variables(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 255)

        assert "a" in circuit.variables
        assert circuit.variables["a"] is a

    def test_duplicate_input_name_raises(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.input("a", 0, 255)

        with pytest.raises(ValueError, match="already exists"):
            circuit.input("a", 0, 255)

    def test_inspect_shows_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", -256, 254)

        assert a.inspect() == "a: BoundedInt<-256, 254>"

    def test_bit_width(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 255)  # 8 bits
        b = circuit.input("b", -128, 127)  # 8 bits (128 needs 8 bits)
        c = circuit.input("c", 0, 65535)  # 16 bits

        assert a.bit_width == 8
        assert b.bit_width == 8
        assert c.bit_width == 16
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_variable.py -v
```

Expected: FAIL with ImportError (BoundedIntCircuit not found)

**Step 3: Implement BoundedIntCircuit core**

```python
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
```

**Step 4: Update __init__.py**

```python
# hydra/bounded_int_circuit/__init__.py
from .variable import BoundedIntVar
from .operation import Operation
from .circuit import BoundedIntCircuit

__all__ = ["BoundedIntVar", "Operation", "BoundedIntCircuit"]
```

**Step 5: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_variable.py -v
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add hydra/bounded_int_circuit/ tests/bounded_int_circuit/
git commit -m "feat: add BoundedIntCircuit with input creation"
```

---

## Task 3: Arithmetic Operations - Add

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Create: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write failing tests for add operation**

```python
# tests/bounded_int_circuit/test_bounds.py
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


class TestAddBounds:
    """Test bound propagation for addition. Based on corelib tests."""

    def test_add_unsigned_bounds(self):
        """u8 + u8 -> [0, 510]. From corelib: AddHelper<u8, u8> Result = BoundedInt<0, 510>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a + b

        assert c.min_bound == 0
        assert c.max_bound == 510

    def test_add_signed_bounds(self):
        """i8 + i8 -> [-256, 254]. From corelib: AddHelper<i8, i8> Result = BoundedInt<-256, 254>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a + b

        assert c.min_bound == -256
        assert c.max_bound == 254

    def test_add_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a + b

        assert len(circuit.operations) == 1
        op = circuit.operations[0]
        assert op.op_type == "ADD"
        assert op.operands == [a, b]
        assert op.result is c

    def test_add_operator_overload(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 100)
        b = circuit.input("b", 0, 50)

        c = a + b  # Using operator overload

        assert c.bounds == (0, 150)

    def test_add_asymmetric_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 10, 20)
        b = circuit.input("b", 5, 15)

        c = a + b

        assert c.bounds == (15, 35)
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestAddBounds -v
```

Expected: FAIL with AttributeError (add method not found)

**Step 3: Implement add method**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestAddBounds -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_bounds.py
git commit -m "feat: add addition with bound propagation"
```

---

## Task 4: Arithmetic Operations - Sub

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write failing tests for sub operation**

Add to `tests/bounded_int_circuit/test_bounds.py`:

```python
class TestSubBounds:
    """Test bound propagation for subtraction. Based on corelib tests."""

    def test_sub_unsigned_produces_signed(self):
        """u8 - u8 -> [-255, 255]. From corelib: SubHelper<u8, u8> Result = BoundedInt<-255, 255>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a - b

        assert c.min_bound == -255
        assert c.max_bound == 255

    def test_sub_signed_bounds(self):
        """i8 - i8 -> [-255, 255]. From corelib: SubHelper<i8, i8> Result = BoundedInt<-255, 255>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a - b

        # -128 - 127 = -255, 127 - (-128) = 255
        assert c.min_bound == -255
        assert c.max_bound == 255

    def test_sub_asymmetric_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 10, 20)
        b = circuit.input("b", 5, 15)

        c = a - b

        # min: 10 - 15 = -5, max: 20 - 5 = 15
        assert c.bounds == (-5, 15)

    def test_sub_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a - b

        assert len(circuit.operations) == 1
        op = circuit.operations[0]
        assert op.op_type == "SUB"
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestSubBounds -v
```

Expected: FAIL

**Step 3: Implement sub method**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
    def sub(self, a: BoundedIntVar, b: BoundedIntVar) -> BoundedIntVar:
        """Subtract two bounded integers."""
        min_val = a.min_bound - b.max_bound
        max_val = a.max_bound - b.min_bound
        result = self._create_op("SUB", [a, b], min_val, max_val)
        return self._maybe_auto_reduce(result)
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestSubBounds -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_bounds.py
git commit -m "feat: add subtraction with bound propagation"
```

---

## Task 5: Arithmetic Operations - Mul

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write failing tests for mul operation**

Add to `tests/bounded_int_circuit/test_bounds.py`:

```python
class TestMulBounds:
    """Test bound propagation for multiplication. Based on corelib tests."""

    def test_mul_unsigned_bounds(self):
        """u8 * u8 -> [0, 65025]. From corelib: MulHelper<u8, u8> Result = BoundedInt<0, 65025>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a * b

        assert c.min_bound == 0
        assert c.max_bound == 65025  # 255 * 255

    def test_mul_signed_bounds(self):
        """i8 * i8 -> [-16256, 16384]. From corelib: MulHelper<i8, i8>"""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        c = a * b

        # Corners: -128*-128=16384, -128*127=-16256, 127*-128=-16256, 127*127=16129
        assert c.min_bound == -16256
        assert c.max_bound == 16384

    def test_mul_mixed_signs(self):
        """Test multiplication with one positive, one negative range."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", -10, 10)
        b = circuit.input("b", 5, 15)

        c = a * b

        # Corners: -10*5=-50, -10*15=-150, 10*5=50, 10*15=150
        assert c.min_bound == -150
        assert c.max_bound == 150

    def test_mul_creates_operation(self):
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        c = a * b

        op = circuit.operations[0]
        assert op.op_type == "MUL"
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestMulBounds -v
```

Expected: FAIL

**Step 3: Implement mul method**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestMulBounds -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_bounds.py
git commit -m "feat: add multiplication with corner-based bound propagation"
```

---

## Task 6: Division and Modulo Operations

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write failing tests for div_rem**

Add to `tests/bounded_int_circuit/test_bounds.py`:

```python
class TestDivRemBounds:
    """Test bound propagation for division. Based on corelib DivRemHelper tests."""

    def test_divrem_basic(self):
        """Division of [128, 255] by [3, 8]."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 128, 255)
        b = circuit.input("b", 3, 8)

        q, r = a.div_rem(b)

        # Quotient: 128/8=16 to 255/3=85
        assert q.min_bound == 16
        assert q.max_bound == 85
        # Remainder: [0, 7] (max divisor - 1)
        assert r.min_bound == 0
        assert r.max_bound == 7

    def test_divrem_by_constant(self):
        """Division by integer constant."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q, r = a.div_rem(256)

        # 0/256=0, 510/256=1
        assert q.bounds == (0, 1)
        assert r.bounds == (0, 255)

    def test_div_operator(self):
        """Test // operator returns quotient only."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q = a // 256

        assert q.bounds == (0, 1)

    def test_mod_operator(self):
        """Test % operator returns remainder only."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        r = a % 256

        assert r.bounds == (0, 255)

    def test_divrem_creates_linked_operations(self):
        """div_rem should create linked DIV and REM operations."""
        circuit = BoundedIntCircuit("test", modulus=256)
        a = circuit.input("a", 0, 510)

        q, r = a.div_rem(256)

        # Should have 2 operations (or 1 combined - implementation detail)
        assert q.source is not None
        assert r.source is not None
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestDivRemBounds -v
```

Expected: FAIL

**Step 3: Implement div_rem, div, mod methods**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
        self.bound_types.add((value, value))

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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestDivRemBounds -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_bounds.py
git commit -m "feat: add div_rem, div, mod with bound propagation"
```

---

## Task 7: Reduce Operation

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write failing tests for reduce**

Add to `tests/bounded_int_circuit/test_bounds.py`:

```python
class TestReduceBounds:
    """Test modular reduction."""

    def test_reduce_resets_to_modulus_range(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a + b  # [0, 24576]
        d = c.reduce()

        assert d.bounds == (0, 12288)

    def test_reduce_negative_input(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a - b  # [-12288, 12288]
        d = c.reduce()

        assert d.bounds == (0, 12288)

    def test_reduce_tracks_quotient_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 24576)

        b = a.reduce()

        op = b.source
        assert op.op_type == "REDUCE"
        # Quotient should be [0, 1] for this range
        assert op.extra["q_bounds"] == (0, 1)

    def test_reduce_large_negative(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", -150994944, 150994944)

        b = a.reduce()

        assert b.bounds == (0, 12288)
        # Quotient bounds for large range
        q_min, q_max = b.source.extra["q_bounds"]
        assert q_min < 0  # Negative quotient needed for negative dividend
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestReduceBounds -v
```

Expected: FAIL

**Step 3: Implement reduce method**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
    def reduce(self, var: BoundedIntVar, modulus: int | None = None) -> BoundedIntVar:
        """Explicit modular reduction. Resets bounds to [0, modulus-1]."""
        modulus = modulus or self.modulus

        # Compute quotient bounds
        q_max = var.max_bound // modulus

        if var.min_bound >= 0:
            q_min = var.min_bound // modulus
        else:
            # For negative dividends, quotient is negative
            # -150994944 // 12289 in Python gives -12289 (floor division)
            q_min = var.min_bound // modulus

        result = self._create_op(
            "REDUCE",
            [var],
            min_val=0,
            max_val=modulus - 1,
            q_bounds=(q_min, q_max),
            modulus=modulus,
        )

        return result
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestReduceBounds -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_bounds.py
git commit -m "feat: add reduce operation with quotient bound tracking"
```

---

## Task 8: Auto-Reduce Threshold

**Files:**
- Modify: `tests/bounded_int_circuit/test_bounds.py`

**Step 1: Write tests for auto-reduce**

Add to `tests/bounded_int_circuit/test_bounds.py`:

```python
class TestAutoReduce:
    """Test automatic reduction when bounds exceed threshold."""

    def test_auto_reduce_on_mul_exceeding_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**20)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # 12288 * 12288 = 150994944 > 2**20 = 1048576
        c = a * b

        # Should auto-reduce
        assert c.bounds == (0, 12288)
        assert c.source.op_type == "REDUCE"

    def test_no_auto_reduce_below_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**64)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        c = a * b  # 150994944 < 2**64

        assert c.bounds == (0, 150994944)
        assert c.source.op_type == "MUL"

    def test_auto_reduce_negative_threshold(self):
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**16)
        a = circuit.input("a", -1000, 1000)
        b = circuit.input("b", -1000, 1000)

        # -1000 * 1000 = -1000000 < -2**16
        c = a * b

        assert c.bounds == (0, 12288)

    def test_hard_max_bound_limit(self):
        """max_bound is capped at 2**128."""
        circuit = BoundedIntCircuit("test", modulus=12289, max_bound=2**200)

        assert circuit.max_bound == 2**128
```

**Step 2: Run tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_bounds.py::TestAutoReduce -v
```

Expected: All tests pass (implementation already handles this)

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_bounds.py
git commit -m "test: add auto-reduce threshold tests"
```

---

## Task 9: Output Registration

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_variable.py`

**Step 1: Write failing tests for output**

Add to `tests/bounded_int_circuit/test_variable.py`:

```python
class TestOutputRegistration:
    def test_output_registration(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a + b

        circuit.output(c, "sum")

        assert len(circuit.outputs) == 1
        assert circuit.outputs[0] is c

    def test_output_rename(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = a + a

        circuit.output(b, "doubled")

        # The variable should be renamed for output
        assert circuit.outputs[0].name == "doubled" or "doubled" in str(circuit.outputs)

    def test_multiple_outputs(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        circuit.output(a + b, "sum")
        circuit.output(a - b, "diff")

        assert len(circuit.outputs) == 2
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_variable.py::TestOutputRegistration -v
```

Expected: FAIL

**Step 3: Implement output method**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_variable.py::TestOutputRegistration -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_variable.py
git commit -m "feat: add output registration with optional renaming"
```

---

## Task 10: Code Generation - Types

**Files:**
- Create: `hydra/bounded_int_circuit/codegen.py`
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Create: `tests/bounded_int_circuit/test_codegen.py`

**Step 1: Write failing tests for type generation**

```python
# tests/bounded_int_circuit/test_codegen.py
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


class TestTypeGeneration:
    def test_generates_type_for_input_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.input("a", 0, 12288)

        types_code = circuit._generate_types()

        assert "type Zq = BoundedInt<0, 12288>;" in types_code

    def test_generates_type_for_negative_bounds(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.input("a", -256, 254)

        types_code = circuit._generate_types()

        assert "BInt_n256_254 = BoundedInt<-256, 254>;" in types_code

    def test_generates_constant_types(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.register_constant(12289, "Q")

        types_code = circuit._generate_types()

        assert "type QConst = UnitInt<12289>;" in types_code

    def test_type_name_for_modulus_range(self):
        circuit = BoundedIntCircuit("test", modulus=12289)

        name = circuit._type_name(0, 12288)

        assert name == "Zq"

    def test_type_name_for_positive_range(self):
        circuit = BoundedIntCircuit("test", modulus=12289)

        name = circuit._type_name(0, 24576)

        assert name == "BInt_0_24576"

    def test_type_name_for_negative_range(self):
        circuit = BoundedIntCircuit("test", modulus=12289)

        name = circuit._type_name(-12288, 12288)

        assert name == "BInt_n12288_12288"
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestTypeGeneration -v
```

Expected: FAIL

**Step 3: Implement type generation**

```python
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
```

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestTypeGeneration -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/codegen.py hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_codegen.py
git commit -m "feat: add Cairo type generation"
```

---

## Task 11: Code Generation - Helper Impls

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_codegen.py`

**Step 1: Write failing tests for helper impl generation**

Add to `tests/bounded_int_circuit/test_codegen.py`:

```python
class TestHelperImplGeneration:
    def test_generates_add_helper(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        _ = a + b

        impls_code = circuit._generate_helper_impls()

        assert "impl Add_Zq_Zq of AddHelper<Zq, Zq>" in impls_code
        assert "type Result = BInt_0_24576;" in impls_code

    def test_generates_sub_helper(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        _ = a - b

        impls_code = circuit._generate_helper_impls()

        assert "SubHelper<Zq, Zq>" in impls_code
        assert "BInt_n12288_12288" in impls_code

    def test_generates_mul_helper(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        _ = a * b

        impls_code = circuit._generate_helper_impls()

        assert "MulHelper<Zq, Zq>" in impls_code

    def test_generates_divrem_helper(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 24576)
        _ = a.reduce()

        impls_code = circuit._generate_helper_impls()

        assert "DivRemHelper<BInt_0_24576, QConst>" in impls_code
        assert "type DivT" in impls_code
        assert "type RemT" in impls_code

    def test_deduplicates_impls(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        _ = a + b
        _ = a + b  # Same operation again

        impls_code = circuit._generate_helper_impls()

        # Should only appear once
        assert impls_code.count("impl Add_Zq_Zq") == 1
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestHelperImplGeneration -v
```

Expected: FAIL

**Step 3: Implement helper impl generation**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
        else:
            b_type = self._type_name(*b.bounds)

        q_min, q_max = op.extra["q_bounds"]
        q_type = self._type_name(q_min, q_max)
        r_type = self._type_name(*op.result.bounds)

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
            elif op.op_type in ("DIV", "REM"):
                # Only generate once per div_rem pair
                if "DIVREM" in impl_key and impl_key not in seen:
                    lines.append(self._gen_divrem_helper(op))

        return "\n\n".join(lines)
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestHelperImplGeneration -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_codegen.py
git commit -m "feat: add helper impl generation with deduplication"
```

---

## Task 12: Code Generation - Function Body

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_codegen.py`

**Step 1: Write failing tests for function generation**

Add to `tests/bounded_int_circuit/test_codegen.py`:

```python
class TestFunctionGeneration:
    def test_generates_function_signature(self):
        circuit = BoundedIntCircuit("add_mod", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a + b
        circuit.output(c.reduce(), "result")

        func_code = circuit._generate_function()

        assert "pub fn add_mod(a: Zq, b: Zq)" in func_code
        assert "-> (Zq)" in func_code or "-> Zq" in func_code

    def test_generates_add_operation(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a + b
        circuit.output(c, "sum")

        func_code = circuit._generate_function()

        assert "add(a, b)" in func_code

    def test_generates_sub_operation(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a - b
        circuit.output(c, "diff")

        func_code = circuit._generate_function()

        assert "sub(a, b)" in func_code

    def test_generates_mul_operation(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a * b
        circuit.output(c, "prod")

        func_code = circuit._generate_function()

        assert "mul(a, b)" in func_code

    def test_generates_reduce_operation(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 24576)
        b = a.reduce()
        circuit.output(b, "reduced")

        func_code = circuit._generate_function()

        assert "bounded_int_div_rem" in func_code
        assert "nz_q" in func_code

    def test_generates_return_statement(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        circuit.output(a + b, "sum")
        circuit.output(a - b, "diff")

        func_code = circuit._generate_function()

        assert "(sum, diff)" in func_code
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestFunctionGeneration -v
```

Expected: FAIL

**Step 3: Implement function generation**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
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
            modulus = op.extra.get("modulus", self.modulus)
            if modulus in self.constants:
                nz_name = f"nz_{self.constants[modulus].lower()}"
            else:
                nz_name = f"nz_{modulus}"
            q_name = f"_{r}_q"
            return f"let ({q_name}, {r}): (_, {r_type}) = bounded_int_div_rem({a.name}, {nz_name});"

        elif op.op_type == "DIV":
            a, b = op.operands
            b_type = self._type_name(*b.bounds)
            nz_name = f"nz_{b.name}"
            r_name = f"_{r}_rem"
            return f"let ({r}, {r_name}): ({r_type}, _) = bounded_int_div_rem({a.name}, {nz_name});"

        elif op.op_type == "REM":
            # REM is generated together with DIV, skip if linked
            if "linked_to" in op.extra:
                return ""  # Already generated with DIV
            a, b = op.operands
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestFunctionGeneration -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_codegen.py
git commit -m "feat: add function body generation"
```

---

## Task 13: Code Generation - Complete Compile

**Files:**
- Modify: `hydra/bounded_int_circuit/circuit.py`
- Modify: `tests/bounded_int_circuit/test_codegen.py`

**Step 1: Write failing tests for compile**

Add to `tests/bounded_int_circuit/test_codegen.py`:

```python
class TestCompile:
    def test_compile_produces_complete_cairo(self):
        circuit = BoundedIntCircuit("add_mod", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = (a + b).reduce()
        circuit.output(c, "result")

        code = circuit.compile()

        # Check all sections present
        assert "use corelib_imports::bounded_int::" in code
        assert "type Zq = BoundedInt<0, 12288>;" in code
        assert "impl Add_Zq_Zq of AddHelper" in code
        assert "const nz_q: NonZero<QConst>" in code
        assert "pub fn add_mod" in code

    def test_compile_imports_are_correct(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        circuit.output(a, "out")

        code = circuit.compile()

        assert "BoundedInt" in code
        assert "AddHelper" in code
        assert "SubHelper" in code
        assert "MulHelper" in code
        assert "DivRemHelper" in code
        assert "bounded_int_div_rem" in code
        assert "add, sub, mul" in code
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestCompile -v
```

Expected: FAIL

**Step 3: Implement compile and related methods**

Add to `hydra/bounded_int_circuit/circuit.py`:

```python
    def _generate_imports(self) -> str:
        """Generate Cairo imports."""
        return """use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};"""

    def _generate_constants(self) -> str:
        """Generate NonZero constant definitions."""
        lines = []
        for value, name in sorted(self.constants.items()):
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
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_codegen.py::TestCompile -v
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add hydra/bounded_int_circuit/circuit.py tests/bounded_int_circuit/test_codegen.py
git commit -m "feat: add complete compile method with imports and constants"
```

---

## Task 14: Scarb Compilation Tests - Basic Operations

**Files:**
- Create: `tests/bounded_int_circuit/test_compilation.py`

**Step 1: Write compilation tests for basic operations**

```python
# tests/bounded_int_circuit/test_compilation.py
"""
Integration tests that compile generated Cairo code with scarb.
Each test creates a micro scarb package and verifies compilation succeeds.

Based on edge cases from:
https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268
"""
import pytest
from hydra.bounded_int_circuit import BoundedIntCircuit


class TestCompilationBasicOps:
    """Test that generated code for basic operations compiles."""

    def test_compile_add_unsigned(self, assert_compiles):
        """u8 + u8 -> [0, 510]"""
        circuit = BoundedIntCircuit("add_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a + b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_add_unsigned")

    def test_compile_add_signed(self, assert_compiles):
        """i8 + i8 -> [-256, 254]"""
        circuit = BoundedIntCircuit("add_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a + b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_add_signed")

    def test_compile_sub_unsigned(self, assert_compiles):
        """u8 - u8 -> [-255, 255]"""
        circuit = BoundedIntCircuit("sub_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a - b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_sub_unsigned")

    def test_compile_sub_signed(self, assert_compiles):
        """i8 - i8 -> [-255, 255]"""
        circuit = BoundedIntCircuit("sub_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a - b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_sub_signed")

    def test_compile_mul_unsigned(self, assert_compiles):
        """u8 * u8 -> [0, 65025]"""
        circuit = BoundedIntCircuit("mul_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)
        c = a * b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mul_unsigned")

    def test_compile_mul_signed(self, assert_compiles):
        """i8 * i8 -> [-16256, 16384]"""
        circuit = BoundedIntCircuit("mul_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)
        c = a * b
        circuit.output(c, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mul_signed")
```

**Step 2: Run compilation tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_compilation.py::TestCompilationBasicOps -v --timeout=120
```

Expected: All tests pass (code compiles with scarb)

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_compilation.py
git commit -m "test: add scarb compilation tests for basic operations"
```

---

## Task 15: Scarb Compilation Tests - Division and Reduce

**Files:**
- Modify: `tests/bounded_int_circuit/test_compilation.py`

**Step 1: Add compilation tests for division and reduce**

Add to `tests/bounded_int_circuit/test_compilation.py`:

```python
class TestCompilationDivRem:
    """Test that generated code for division operations compiles."""

    def test_compile_reduce(self, assert_compiles):
        """Test modular reduction compiles."""
        circuit = BoundedIntCircuit("reduce_test", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 24576)
        b = a.reduce()
        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_reduce")

    def test_compile_reduce_negative(self, assert_compiles):
        """Test reduction of negative range compiles."""
        circuit = BoundedIntCircuit("reduce_neg", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", -12288, 12288)
        b = a.reduce()
        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_reduce_negative")

    def test_compile_divrem_basic(self, assert_compiles):
        """Test div_rem compiles. Based on corelib SmallNumDivRemRes."""
        circuit = BoundedIntCircuit("divrem_test", modulus=256)
        a = circuit.input("a", 128, 255)
        b = circuit.input("b", 3, 8)
        q, r = a.div_rem(b)
        circuit.output(q, "quotient")
        circuit.output(r, "remainder")

        code = circuit.compile()
        assert_compiles(code, "test_divrem")

    def test_compile_div_by_constant(self, assert_compiles):
        """Test division by constant compiles."""
        circuit = BoundedIntCircuit("div_const", modulus=256)
        circuit.register_constant(100, "HUNDRED")
        a = circuit.input("a", 0, 1000)
        q = a // 100
        circuit.output(q, "result")

        code = circuit.compile()
        assert_compiles(code, "test_div_const")

    def test_compile_mod_operator(self, assert_compiles):
        """Test % operator compiles."""
        circuit = BoundedIntCircuit("mod_test", modulus=256)
        circuit.register_constant(100, "HUNDRED")
        a = circuit.input("a", 0, 1000)
        r = a % 100
        circuit.output(r, "result")

        code = circuit.compile()
        assert_compiles(code, "test_mod")
```

**Step 2: Run compilation tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_compilation.py::TestCompilationDivRem -v --timeout=120
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_compilation.py
git commit -m "test: add scarb compilation tests for division and reduce"
```

---

## Task 16: Scarb Compilation Tests - Complex Circuits

**Files:**
- Modify: `tests/bounded_int_circuit/test_compilation.py`

**Step 1: Add compilation tests for complex circuits**

Add to `tests/bounded_int_circuit/test_compilation.py`:

```python
class TestCompilationComplex:
    """Test compilation of more complex circuits."""

    def test_compile_ntt_butterfly(self, assert_compiles):
        """Test NTT butterfly pattern compiles."""
        circuit = BoundedIntCircuit("ntt_butterfly", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        w = circuit.input("w", 0, 12288)

        sum_ab = a + b
        diff_ab = a - b
        prod = diff_ab * w

        r0 = sum_ab.reduce()
        r1 = prod.reduce()

        circuit.output(r0, "r0")
        circuit.output(r1, "r1")

        code = circuit.compile()
        assert_compiles(code, "test_ntt_butterfly")

    def test_compile_chained_operations(self, assert_compiles):
        """Test chained operations compile."""
        circuit = BoundedIntCircuit("chain", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = circuit.input("c", 0, 12288)

        # (a + b) * c, then reduce
        t1 = a + b
        t2 = t1 * c
        result = t2.reduce()

        circuit.output(result, "result")

        code = circuit.compile()
        assert_compiles(code, "test_chain")

    def test_compile_multiple_reductions(self, assert_compiles):
        """Test multiple reductions in one circuit."""
        circuit = BoundedIntCircuit("multi_reduce", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        sum1 = (a + b).reduce()
        sum2 = (sum1 + a).reduce()
        sum3 = (sum2 + b).reduce()

        circuit.output(sum3, "result")

        code = circuit.compile()
        assert_compiles(code, "test_multi_reduce")

    def test_compile_falcon_style_mod(self, assert_compiles):
        """Test Falcon-style modular arithmetic (Q=12289)."""
        circuit = BoundedIntCircuit("falcon_mod", modulus=12289)
        circuit.register_constant(12289, "Q")

        # Zq inputs
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # Add and reduce
        sum_val = a + b  # [0, 24576]
        reduced = sum_val.reduce()  # [0, 12288]

        circuit.output(reduced, "result")

        code = circuit.compile()
        assert_compiles(code, "test_falcon_mod")

    def test_compile_wide_range(self, assert_compiles):
        """Test compilation with wide intermediate ranges."""
        circuit = BoundedIntCircuit("wide_range", modulus=12289, max_bound=2**64)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)

        # Large product without auto-reduce
        prod = a * b  # [0, 150994944]

        # Explicit reduce
        result = prod.reduce()

        circuit.output(result, "result")

        code = circuit.compile()
        assert_compiles(code, "test_wide_range")
```

**Step 2: Run compilation tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_compilation.py::TestCompilationComplex -v --timeout=180
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_compilation.py
git commit -m "test: add scarb compilation tests for complex circuits"
```

---

## Task 17: Scarb Compilation Tests - Edge Cases from Corelib

**Files:**
- Modify: `tests/bounded_int_circuit/test_compilation.py`

**Step 1: Add edge case tests based on corelib**

Add to `tests/bounded_int_circuit/test_compilation.py`:

```python
class TestCompilationEdgeCases:
    """
    Edge cases from Cairo corelib bounded_int tests.
    Reference: https://github.com/starkware-libs/cairo/blob/main/corelib/src/test/integer_test.cairo#L1939-L2268
    """

    def test_compile_boundary_values_u8(self, assert_compiles):
        """Test boundary values for u8."""
        circuit = BoundedIntCircuit("boundary_u8", modulus=256)
        a = circuit.input("a", 0, 255)
        b = circuit.input("b", 0, 255)

        # Max + Max
        c = a + b  # [0, 510]
        circuit.output(c, "sum")

        # Max * Max
        d = a * b  # [0, 65025]
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_boundary_u8")

    def test_compile_boundary_values_i8(self, assert_compiles):
        """Test boundary values for i8."""
        circuit = BoundedIntCircuit("boundary_i8", modulus=256)
        a = circuit.input("a", -128, 127)
        b = circuit.input("b", -128, 127)

        # -128 + -128 = -256
        c = a + b  # [-256, 254]
        circuit.output(c, "sum")

        # -128 * -128 = 16384
        d = a * b  # [-16256, 16384]
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_boundary_i8")

    def test_compile_asymmetric_ranges(self, assert_compiles):
        """Test operations on asymmetric ranges."""
        circuit = BoundedIntCircuit("asymmetric", modulus=256)
        a = circuit.input("a", 10, 50)
        b = circuit.input("b", 100, 200)

        c = a + b  # [110, 250]
        d = a - b  # [-190, -50]
        e = a * b  # [1000, 10000]

        circuit.output(c, "sum")
        circuit.output(d, "diff")
        circuit.output(e, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_asymmetric")

    def test_compile_singleton_constant(self, assert_compiles):
        """Test UnitInt singleton types."""
        circuit = BoundedIntCircuit("singleton", modulus=256)
        circuit.register_constant(42, "ANSWER")

        a = circuit.input("a", 0, 255)
        b = circuit.constant(42, "const_42")

        c = a + b  # Constant addition not directly supported, use mul by 1 pattern
        circuit.output(c, "result")

        code = circuit.compile()
        # May need adjustment based on how constant ops are handled
        assert_compiles(code, "test_singleton")

    def test_compile_large_negative_range(self, assert_compiles):
        """Test large negative ranges."""
        circuit = BoundedIntCircuit("large_neg", modulus=12289)
        circuit.register_constant(12289, "Q")

        a = circuit.input("a", -150994944, 150994944)
        b = a.reduce()

        circuit.output(b, "result")

        code = circuit.compile()
        assert_compiles(code, "test_large_neg")

    def test_compile_zero_crossing(self, assert_compiles):
        """Test range that crosses zero."""
        circuit = BoundedIntCircuit("zero_cross", modulus=256)
        a = circuit.input("a", -50, 50)
        b = circuit.input("b", -50, 50)

        c = a + b  # [-100, 100]
        d = a * b  # [-2500, 2500]

        circuit.output(c, "sum")
        circuit.output(d, "prod")

        code = circuit.compile()
        assert_compiles(code, "test_zero_cross")
```

**Step 2: Run edge case tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_compilation.py::TestCompilationEdgeCases -v --timeout=180
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_compilation.py
git commit -m "test: add scarb compilation tests for corelib edge cases"
```

---

## Task 18: Debugging and Inspection Methods

**Files:**
- Modify: `tests/bounded_int_circuit/test_variable.py`

**Step 1: Write tests for debugging methods**

Add to `tests/bounded_int_circuit/test_variable.py`:

```python
class TestDebugging:
    def test_print_bounds(self, capsys):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        _ = a + b

        circuit.print_bounds()

        captured = capsys.readouterr()
        assert "Circuit 'test'" in captured.out
        assert "a: BoundedInt<0, 12288>" in captured.out
        assert "b: BoundedInt<0, 12288>" in captured.out

    def test_stats(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        c = a + b
        d = c.reduce()
        circuit.output(d, "result")

        stats = circuit.stats()

        assert stats["num_operations"] == 2  # ADD + REDUCE
        assert stats["num_reductions"] == 1
        assert stats["num_variables"] >= 3  # a, b, c, d (some may share)

    def test_max_bits(self):
        circuit = BoundedIntCircuit("test", modulus=12289)
        a = circuit.input("a", 0, 255)  # 8 bits
        b = circuit.input("b", 0, 65535)  # 16 bits

        assert circuit.max_bits() == 16
```

**Step 2: Run tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_variable.py::TestDebugging -v
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_variable.py
git commit -m "test: add debugging and inspection tests"
```

---

## Task 19: Final Integration Test

**Files:**
- Modify: `tests/bounded_int_circuit/test_compilation.py`

**Step 1: Add full integration test**

Add to `tests/bounded_int_circuit/test_compilation.py`:

```python
class TestFullIntegration:
    """Full integration test matching the design doc example."""

    def test_design_doc_example(self, assert_compiles):
        """Test the exact example from the design document."""
        circuit = BoundedIntCircuit(
            name="ntt_butterfly",
            modulus=12289,
            max_bound=2**64,
        )

        circuit.register_constant(12289, "Q")

        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        w = circuit.input("w", 0, 12288)

        sum_ab = a + b
        diff_ab = a - b
        prod = diff_ab * w

        # Verify bounds at each step
        assert sum_ab.bounds == (0, 24576)
        assert diff_ab.bounds == (-12288, 12288)
        assert prod.bounds == (-150994944, 150994944)

        r0 = sum_ab.reduce()
        r1 = prod.reduce()

        circuit.output(r0, "r0")
        circuit.output(r1, "r1")

        code = circuit.compile()

        # Verify generated code structure
        assert "type Zq = BoundedInt<0, 12288>;" in code
        assert "type BInt_0_24576 = BoundedInt<0, 24576>;" in code
        assert "type BInt_n12288_12288 = BoundedInt<-12288, 12288>;" in code
        assert "impl Add_Zq_Zq of AddHelper<Zq, Zq>" in code
        assert "impl Sub_Zq_Zq of SubHelper<Zq, Zq>" in code
        assert "pub fn ntt_butterfly(a: Zq, b: Zq, w: Zq)" in code

        # Compile with scarb
        assert_compiles(code, "test_design_doc")

    def test_write_to_file(self, tmp_path):
        """Test writing circuit to file."""
        circuit = BoundedIntCircuit("test_write", modulus=12289)
        circuit.register_constant(12289, "Q")
        a = circuit.input("a", 0, 12288)
        b = circuit.input("b", 0, 12288)
        circuit.output((a + b).reduce(), "result")

        output_path = tmp_path / "generated.cairo"
        circuit.write(str(output_path))

        assert output_path.exists()
        content = output_path.read_text()
        assert "pub fn test_write" in content
```

**Step 2: Run integration tests**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/test_compilation.py::TestFullIntegration -v --timeout=120
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/bounded_int_circuit/test_compilation.py
git commit -m "test: add full integration tests matching design doc"
```

---

## Task 20: Run All Tests and Final Verification

**Step 1: Run complete test suite**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -m pytest tests/bounded_int_circuit/ -v --timeout=300
```

Expected: All tests pass

**Step 2: Verify the module is importable**

```bash
cd /home/felt/PycharmProjects/s2morrow && python -c "from hydra.bounded_int_circuit import BoundedIntCircuit; print('Import successful')"
```

Expected: "Import successful"

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete BoundedIntCircuit implementation with full test coverage"
```

---

## Summary

This plan implements `BoundedIntCircuit` in 20 tasks:

1. **Tasks 1-2**: Project setup and input creation
2. **Tasks 3-5**: Arithmetic operations (add, sub, mul)
3. **Tasks 6-8**: Division, reduce, auto-reduce
4. **Tasks 9**: Output registration
5. **Tasks 10-13**: Code generation (types, impls, function, compile)
6. **Tasks 14-17**: Scarb compilation tests (basic, divrem, complex, edge cases)
7. **Tasks 18-20**: Debugging, integration, final verification

Each test creates a micro scarb package to verify generated code compiles successfully.
