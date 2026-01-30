# NTT BoundedInt Circuit Generator - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python circuit generator that produces fully-unrolled Cairo `ntt_512` using `BoundedIntCircuit`, matching the output of the recursive `ntt()` in `packages/falcon/src/ntt.cairo`.

**Architecture:** Python generator recursively builds an NTT circuit via `BoundedIntCircuit` DSL. The circuit traces ~7000 operations (mul, add, sub, reduce) through 9 recursion levels (log₂(512)). Output is a Cairo `.cairo` file with 512 parameters, ~7000 statements, and required type aliases/impls.

**Tech Stack:** Python 3.10+, `hydra.bounded_int_circuit.BoundedIntCircuit`, `hydra.falcon_py.ntt_constants.roots_dict_Zq`

---

## Task 1: Create compilable_circuits Module Skeleton

**Files:**
- Create: `hydra/compilable_circuits/__init__.py`
- Create: `hydra/compilable_circuits/ntt.py`
- Create: `tests/compilable_circuits/__init__.py`
- Create: `tests/compilable_circuits/conftest.py`

**Step 1.1: Create `hydra/compilable_circuits/__init__.py`**

```python
# hydra/compilable_circuits/__init__.py
"""
Compilable circuit generators.

Each generator produces Cairo code using BoundedIntCircuit DSL.
"""
```

**Step 1.2: Create minimal `hydra/compilable_circuits/ntt.py`**

```python
# hydra/compilable_circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from hydra.bounded_int_circuit import BoundedIntCircuit
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class NttCircuitGenerator:
    """Generate NTT circuits using BoundedIntCircuit DSL."""

    Q = 12289
    SQR1 = roots_dict_Zq[2][0]  # = 1479, sqrt(-1) mod Q

    def __init__(self, n: int = 512):
        """
        Initialize generator for NTT of size n.

        Args:
            n: Transform size (must be power of 2, max 1024)
        """
        if n & (n - 1) != 0 or n < 2 or n > 1024:
            raise ValueError(f"n must be power of 2 in [2, 1024], got {n}")
        self.n = n
        self.circuit = BoundedIntCircuit(f"ntt_{n}_inner", modulus=self.Q)
```

**Step 1.3: Create `tests/compilable_circuits/__init__.py`**

```python
# tests/compilable_circuits/__init__.py
```

**Step 1.4: Create `tests/compilable_circuits/conftest.py`**

```python
# tests/compilable_circuits/conftest.py
import pytest

# Reuse fixtures from bounded_int_circuit tests
pytest_plugins = ["tests.bounded_int_circuit.conftest"]
```

**Step 1.5: Run import test**

Run: `python -c "from hydra.compilable_circuits.ntt import NttCircuitGenerator; print('OK')"`
Expected: `OK`

**Step 1.6: Commit**

```bash
git add hydra/compilable_circuits/ tests/compilable_circuits/
git commit -m "feat: add compilable_circuits module skeleton"
```

---

## Task 2: Implement Constant Registration

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Create: `tests/compilable_circuits/test_ntt.py`

**Step 2.1: Write the failing test for constant registration**

```python
# tests/compilable_circuits/test_ntt.py
"""Tests for NTT circuit generator."""
import pytest
from hydra.compilable_circuits.ntt import NttCircuitGenerator
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class TestConstantRegistration:
    """Test twiddle factor constant registration."""

    def test_sqr1_registered(self):
        """SQR1 constant is registered."""
        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        assert 1479 in gen.circuit.constants
        assert gen.circuit.constants[1479] == "SQR1"

    def test_roots_registered_for_n4(self):
        """Twiddle factors registered for n=4."""
        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # n=4 needs SQR1 for base case and W4_0 for merge
        assert 1479 in gen.circuit.constants  # SQR1

        # W4_0 = roots_dict_Zq[4][0] = 4043
        assert 4043 in gen.circuit.constants
        assert gen.circuit.constants[4043] == "W4_0"

    def test_roots_registered_for_n8(self):
        """Twiddle factors registered for n=8."""
        gen = NttCircuitGenerator(n=8)
        gen._register_constants()

        # n=8 needs W4, W8 roots
        # W8 roots: roots_dict_Zq[8] = [5736, 6553, 4134, 8155, ...]
        # We use even indices: W8_0=5736, W8_1=4134
        roots_8 = roots_dict_Zq[8]
        assert roots_8[0] in gen.circuit.constants  # W8_0 = 5736
        assert roots_8[2] in gen.circuit.constants  # W8_1 = 4134
```

**Step 2.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestConstantRegistration -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute '_register_constants'`

**Step 2.3: Implement `_register_constants` method**

Update `hydra/compilable_circuits/ntt.py`:

```python
# hydra/compilable_circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from hydra.bounded_int_circuit import BoundedIntCircuit
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class NttCircuitGenerator:
    """Generate NTT circuits using BoundedIntCircuit DSL."""

    Q = 12289
    SQR1 = roots_dict_Zq[2][0]  # = 1479, sqrt(-1) mod Q

    def __init__(self, n: int = 512):
        """
        Initialize generator for NTT of size n.

        Args:
            n: Transform size (must be power of 2, max 1024)
        """
        if n & (n - 1) != 0 or n < 2 or n > 1024:
            raise ValueError(f"n must be power of 2 in [2, 1024], got {n}")
        self.n = n
        self.circuit = BoundedIntCircuit(f"ntt_{n}_inner", modulus=self.Q)

    def _register_constants(self) -> None:
        """Register all twiddle factor constants needed for NTT."""
        # SQR1 for base case (n=2)
        self.circuit.register_constant(self.SQR1, "SQR1")

        # Q for modular reduction
        self.circuit.register_constant(self.Q, "Q")

        # Register roots for each merge level
        # For merge at size `size`, we need roots from roots_dict_Zq[size]
        # We only use even-indexed roots (0, 2, 4, ...) since the algorithm
        # uses w[2*i] for index i in [0, n/2)
        size = 4
        while size <= self.n:
            roots = roots_dict_Zq[size]
            # Even indices only: roots[0], roots[2], roots[4], ...
            for i in range(0, len(roots), 2):
                root_value = roots[i]
                root_name = f"W{size}_{i // 2}"
                if root_value not in self.circuit.constants:
                    self.circuit.register_constant(root_value, root_name)
            size *= 2
```

**Step 2.4: Run test to verify it passes**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestConstantRegistration -v`
Expected: PASS (all 3 tests)

**Step 2.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: implement NTT twiddle factor constant registration"
```

---

## Task 3: Implement Base Case (n=2) NTT

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 3.1: Write the failing test for n=2 NTT**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestBaseCase:
    """Test n=2 base case NTT."""

    def test_ntt_2_creates_circuit(self):
        """n=2 NTT creates a circuit with correct structure."""
        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        # Create inputs
        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        # Run base case
        result = gen._ntt_base_case(f0, f1)

        # Should return 2 outputs
        assert len(result) == 2

        # Check operations were recorded (mul, add, sub)
        assert len(gen.circuit.operations) >= 3

    def test_ntt_2_matches_reference(self):
        """n=2 NTT matches reference algorithm values."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        gen = NttCircuitGenerator(n=2)
        gen._register_constants()

        # Create inputs
        f0 = gen.circuit.input("f0", 0, gen.Q - 1)
        f1 = gen.circuit.input("f1", 0, gen.Q - 1)

        # Run base case
        result = gen._ntt_base_case(f0, f1)

        # Mark outputs
        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        # Simulate with test values
        test_input = [100, 200]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"Expected {expected}, got {actual}"
```

**Step 3.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestBaseCase -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute '_ntt_base_case'`

**Step 3.3: Implement base case and simulate methods**

Update `hydra/compilable_circuits/ntt.py`:

```python
# hydra/compilable_circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from hydra.bounded_int_circuit import BoundedIntCircuit
from hydra.bounded_int_circuit.variable import BoundedIntVar
from hydra.falcon_py.ntt_constants import roots_dict_Zq


class NttCircuitGenerator:
    """Generate NTT circuits using BoundedIntCircuit DSL."""

    Q = 12289
    SQR1 = roots_dict_Zq[2][0]  # = 1479, sqrt(-1) mod Q

    def __init__(self, n: int = 512):
        """
        Initialize generator for NTT of size n.

        Args:
            n: Transform size (must be power of 2, max 1024)
        """
        if n & (n - 1) != 0 or n < 2 or n > 1024:
            raise ValueError(f"n must be power of 2 in [2, 1024], got {n}")
        self.n = n
        self.circuit = BoundedIntCircuit(f"ntt_{n}_inner", modulus=self.Q)

    def _register_constants(self) -> None:
        """Register all twiddle factor constants needed for NTT."""
        # SQR1 for base case (n=2)
        self.circuit.register_constant(self.SQR1, "SQR1")

        # Q for modular reduction
        self.circuit.register_constant(self.Q, "Q")

        # Register roots for each merge level
        size = 4
        while size <= self.n:
            roots = roots_dict_Zq[size]
            for i in range(0, len(roots), 2):
                root_value = roots[i]
                root_name = f"W{size}_{i // 2}"
                if root_value not in self.circuit.constants:
                    self.circuit.register_constant(root_value, root_name)
            size *= 2

    def _ntt_base_case(self, f0: BoundedIntVar, f1: BoundedIntVar) -> list[BoundedIntVar]:
        """
        NTT base case for n=2.

        Computes:
            r0 = (f0 + sqr1 * f1) mod Q
            r1 = (f0 - sqr1 * f1) mod Q

        Returns unreduced results (caller should reduce).
        """
        sqr1 = self.circuit.constant(self.SQR1, "sqr1")

        # f1 * sqr1
        f1_j = f1 * sqr1

        # f0 + f1_j, f0 - f1_j
        even = f0 + f1_j
        odd = f0 - f1_j

        return [even, odd]

    def simulate(self, values: list[int]) -> list[int]:
        """
        Execute the traced operations on actual values.

        This replays the circuit operations on concrete integers
        to verify correctness without generating Cairo code.
        """
        if len(values) != len(self.circuit.inputs):
            raise ValueError(
                f"Expected {len(self.circuit.inputs)} values, got {len(values)}"
            )

        # Map variable names to their current values
        env: dict[str, int] = {}

        # Initialize inputs
        for i, inp in enumerate(self.circuit.inputs):
            env[inp.name] = values[i]

        # Initialize constants
        for val, name in self.circuit.constants.items():
            const_name = name.lower() + "_const" if name != "Q" else "q_const"
            # Find the constant variable in circuit
            for var_name, var in self.circuit.variables.items():
                if var.min_bound == var.max_bound == val:
                    env[var_name] = val

        # Execute operations
        for op in self.circuit.operations:
            if op.op_type == "ADD":
                a, b = op.operands
                env[op.result.name] = env[a.name] + env[b.name]
            elif op.op_type == "SUB":
                a, b = op.operands
                env[op.result.name] = env[a.name] - env[b.name]
            elif op.op_type == "MUL":
                a, b = op.operands
                env[op.result.name] = env[a.name] * env[b.name]
            elif op.op_type == "REDUCE":
                a = op.operands[0]
                modulus = op.extra.get("modulus", self.Q)
                env[op.result.name] = env[a.name] % modulus
            elif op.op_type in ("DIV", "REM"):
                # Handle div_rem pairs
                a = op.operands[0]
                b = op.operands[1] if len(op.operands) > 1 else None
                divisor = env[b.name] if b else op.extra.get("modulus", self.Q)
                if op.op_type == "DIV":
                    env[op.result.name] = env[a.name] // divisor
                else:
                    env[op.result.name] = env[a.name] % divisor

        # Collect outputs
        return [env[out.name] for out in self.circuit.outputs]
```

**Step 3.4: Run test to verify it passes**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestBaseCase -v`
Expected: PASS

**Step 3.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: implement NTT base case (n=2) with simulation"
```

---

## Task 4: Implement Split and Merge Operations

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 4.1: Write the failing test for split**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestSplitMerge:
    """Test split and merge operations."""

    def test_split_even_odd(self):
        """Split separates even and odd indices."""
        gen = NttCircuitGenerator(n=4)

        # Create mock inputs as list
        coeffs = ["f0", "f1", "f2", "f3"]

        f0, f1 = gen._split(coeffs)

        # Even indices: f0, f2
        assert f0 == ["f0", "f2"]
        # Odd indices: f1, f3
        assert f1 == ["f1", "f3"]

    def test_merge_ntt_n4(self):
        """Merge combines two n=2 NTTs into n=4."""
        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # Create inputs for two base NTTs
        f0_ntt = [
            gen.circuit.input("a0", 0, gen.Q - 1),
            gen.circuit.input("a1", 0, gen.Q - 1),
        ]
        f1_ntt = [
            gen.circuit.input("b0", 0, gen.Q - 1),
            gen.circuit.input("b1", 0, gen.Q - 1),
        ]

        # Merge
        result = gen._merge_ntt(f0_ntt, f1_ntt, size=4)

        # Result should have 4 elements
        assert len(result) == 4

        # Operations should include multiplications by twiddle factors
        mul_ops = [op for op in gen.circuit.operations if op.op_type == "MUL"]
        assert len(mul_ops) >= 2  # At least 2 twiddle multiplications
```

**Step 4.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestSplitMerge -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute '_split'`

**Step 4.3: Implement split and merge methods**

Add to `hydra/compilable_circuits/ntt.py`:

```python
    def _split(self, coeffs: list) -> tuple[list, list]:
        """
        Split list into even and odd indices.

        This is a compile-time operation on the coefficient list,
        not a circuit operation.
        """
        return coeffs[::2], coeffs[1::2]

    def _merge_ntt(
        self,
        f0_ntt: list[BoundedIntVar],
        f1_ntt: list[BoundedIntVar],
        size: int
    ) -> list[BoundedIntVar]:
        """
        Merge two NTT halves using butterflies with twiddle factors.

        For i in [0, size/2):
            result[2*i]   = f0_ntt[i] + w[2*i] * f1_ntt[i]
            result[2*i+1] = f0_ntt[i] - w[2*i] * f1_ntt[i]

        where w = roots_dict_Zq[size].

        Returns unreduced results.
        """
        roots = roots_dict_Zq[size]
        result = []

        for i in range(len(f0_ntt)):
            # Get twiddle factor w[2*i]
            twiddle_value = roots[2 * i]
            twiddle = self.circuit.constant(twiddle_value, f"w{size}_{i}")

            # prod = f1_ntt[i] * twiddle
            prod = f1_ntt[i] * twiddle

            # even = f0_ntt[i] + prod
            even = f0_ntt[i] + prod

            # odd = f0_ntt[i] - prod
            odd = f0_ntt[i] - prod

            result.append(even)
            result.append(odd)

        return result
```

**Step 4.4: Run test to verify it passes**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestSplitMerge -v`
Expected: PASS

**Step 4.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: implement NTT split and merge operations"
```

---

## Task 5: Implement Full Recursive NTT

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 5.1: Write the failing test for recursive NTT**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestRecursiveNtt:
    """Test full recursive NTT."""

    def test_ntt_4_matches_reference(self):
        """n=4 NTT matches reference algorithm."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        gen = NttCircuitGenerator(n=4)
        gen._register_constants()

        # Create inputs
        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(4)]

        # Run NTT
        result = gen._ntt(inputs)

        # Mark outputs with reduction
        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        # Test with values
        test_input = [100, 200, 300, 400]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=4: Expected {expected}, got {actual}"

    def test_ntt_8_matches_reference(self):
        """n=8 NTT matches reference algorithm."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        gen = NttCircuitGenerator(n=8)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(8)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, 9))
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n=8: Expected {expected}, got {actual}"
```

**Step 5.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestRecursiveNtt -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute '_ntt'`

**Step 5.3: Implement recursive NTT method**

Add to `hydra/compilable_circuits/ntt.py`:

```python
    def _ntt(self, f: list[BoundedIntVar]) -> list[BoundedIntVar]:
        """
        Recursive NTT - operations are traced into circuit.

        For n=2: base case with SQR1
        For n>2: split -> recurse on halves -> merge

        Returns unreduced results.
        """
        n = len(f)

        if n == 2:
            return self._ntt_base_case(f[0], f[1])
        else:
            # Split into even/odd indices
            f0, f1 = self._split(f)

            # Recursive NTT on each half
            f0_ntt = self._ntt(f0)
            f1_ntt = self._ntt(f1)

            # Merge using butterflies with twiddle factors
            return self._merge_ntt(f0_ntt, f1_ntt, n)
```

**Step 5.4: Run test to verify it passes**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestRecursiveNtt -v`
Expected: PASS

**Step 5.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: implement full recursive NTT algorithm"
```

---

## Task 6: Test NTT at Larger Sizes

**Files:**
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 6.1: Write test for larger NTT sizes**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
import random


class TestLargerSizes:
    """Test NTT at larger sizes up to 512."""

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_ntt_matches_reference_sequential(self, n):
        """NTT matches reference for sequential input."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = list(range(1, n + 1))
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} sequential: mismatch"

    @pytest.mark.parametrize("n", [16, 32, 64])
    def test_ntt_matches_reference_random(self, n):
        """NTT matches reference for random input."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        random.seed(42)

        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [random.randint(0, gen.Q - 1) for _ in range(n)]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, f"n={n} random: mismatch"

    def test_ntt_512_matches_reference(self):
        """n=512 NTT matches reference algorithm."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        random.seed(42)

        gen = NttCircuitGenerator(n=512)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(512)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        # Test with random values
        test_input = [random.randint(0, gen.Q - 1) for _ in range(512)]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected, "n=512: NTT mismatch"

        # Check statistics
        stats = gen.circuit.stats()
        print(f"\nn=512 stats: {stats}")
        assert stats["num_operations"] > 5000, "Expected >5000 operations for n=512"
```

**Step 6.2: Run tests**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestLargerSizes -v`
Expected: PASS (all tests)

**Step 6.3: Commit**

```bash
git add tests/compilable_circuits/test_ntt.py
git commit -m "test: verify NTT correctness at sizes up to 512"
```

---

## Task 7: Implement Code Generation

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 7.1: Write the failing test for code generation**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestCodeGeneration:
    """Test Cairo code generation."""

    def test_generate_ntt_2(self):
        """Generate Cairo code for n=2 NTT."""
        gen = NttCircuitGenerator(n=2)
        code = gen.generate()

        # Check structure
        assert "pub fn ntt_2_inner(f0: Zq, f1: Zq)" in code
        assert "use corelib_imports::bounded_int::" in code
        assert "type Zq = BoundedInt<0, 12288>;" in code

    def test_generate_ntt_4_compiles(self, assert_compiles):
        """Generate Cairo code for n=4 NTT that compiles."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate()

        # Should compile
        assert_compiles(code, "test_ntt_4")

    def test_generate_ntt_8_compiles(self, assert_compiles):
        """Generate Cairo code for n=8 NTT that compiles."""
        gen = NttCircuitGenerator(n=8)
        code = gen.generate()

        assert_compiles(code, "test_ntt_8")
```

**Step 7.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestCodeGeneration::test_generate_ntt_2 -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute 'generate'`

**Step 7.3: Implement generate method**

Add to `hydra/compilable_circuits/ntt.py`:

```python
    def generate(self) -> str:
        """
        Build circuit and compile to Cairo.

        Returns:
            Complete Cairo source file as string.
        """
        # Reset circuit for fresh generation
        self.circuit = BoundedIntCircuit(f"ntt_{self.n}_inner", modulus=self.Q)
        self._register_constants()

        # Create inputs
        inputs = [
            self.circuit.input(f"f{i}", 0, self.Q - 1)
            for i in range(self.n)
        ]

        # Run NTT (traces all operations)
        outputs = self._ntt(inputs)

        # Mark outputs with reduction
        for i, out in enumerate(outputs):
            self.circuit.output(out.reduce(), f"r{i}")

        # Generate Cairo code
        return self.circuit.compile()
```

**Step 7.4: Run tests**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestCodeGeneration -v`
Expected: PASS (all 3 tests)

**Step 7.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: implement Cairo code generation for NTT"
```

---

## Task 8: Add Public API Wrapper Generation

**Files:**
- Modify: `hydra/compilable_circuits/ntt.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

The inner function has 512 parameters. We need a public API that takes `Array<Zq>` and unpacks it.

**Step 8.1: Write the failing test**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestPublicApiWrapper:
    """Test public API wrapper generation."""

    def test_generate_full_includes_wrapper(self):
        """Full generation includes public ntt_512 wrapper."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate_full()

        # Inner function
        assert "fn ntt_4_inner(" in code

        # Public wrapper
        assert "pub fn ntt_4(mut f: Array<Zq>) -> Array<Zq>" in code
        assert "multi_pop_front::<4>()" in code
        assert "array![r0, r1, r2, r3]" in code

    def test_generate_full_header(self):
        """Full generation includes auto-generated header."""
        gen = NttCircuitGenerator(n=4)
        code = gen.generate_full()

        assert "// Auto-generated by hydra/compilable_circuits/ntt.py" in code
        assert "// DO NOT EDIT MANUALLY" in code
```

**Step 8.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestPublicApiWrapper -v`
Expected: FAIL with `AttributeError: 'NttCircuitGenerator' object has no attribute 'generate_full'`

**Step 8.3: Implement generate_full method**

Add to `hydra/compilable_circuits/ntt.py`:

```python
    def generate_full(self) -> str:
        """
        Generate complete Cairo file with inner function and public wrapper.

        Returns:
            Complete Cairo source file with:
            - Auto-generated header
            - All imports
            - Type definitions
            - Helper impls
            - Inner function (ntt_N_inner with N separate params)
            - Public wrapper (ntt_N taking Array<Zq>)
        """
        # Generate inner function code
        inner_code = self.generate()

        # Build header
        header = f"""// Auto-generated by hydra/compilable_circuits/ntt.py
// DO NOT EDIT MANUALLY - regenerate with: python -m hydra.compilable_circuits.regenerate ntt

"""

        # Build public wrapper
        n = self.n

        # Parameter names for multi_pop_front destructuring
        param_names = ", ".join(f"f{i}" for i in range(n))

        # Arguments to inner function call
        inner_args = ", ".join(f"f{i}" for i in range(n))

        # Output names from inner function
        output_names = ", ".join(f"r{i}" for i in range(n))

        # Array construction
        array_items = ", ".join(f"r{i}" for i in range(n))

        wrapper = f"""
/// NTT of size {n} using Array<Zq> interface.
pub fn ntt_{n}(mut f: Array<Zq>) -> Array<Zq> {{
    let f_span = f.span();
    let [{param_names}] = *f_span
        .multi_pop_front::<{n}>()
        .expect('expected {n} elements');

    let ({output_names}) = ntt_{n}_inner({inner_args});

    array![{array_items}]
}}
"""

        return header + inner_code + wrapper
```

**Step 8.4: Run test**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestPublicApiWrapper -v`
Expected: PASS

**Step 8.5: Commit**

```bash
git add hydra/compilable_circuits/ntt.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: add public API wrapper generation for NTT"
```

---

## Task 9: Implement Regeneration CLI

**Files:**
- Create: `hydra/compilable_circuits/regenerate.py`
- Modify: `tests/compilable_circuits/test_ntt.py`

**Step 9.1: Write the failing test**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
import subprocess
import tempfile
from pathlib import Path


class TestRegenerateCli:
    """Test regeneration CLI."""

    def test_cli_generates_file(self, tmp_path):
        """CLI generates ntt_bounded_int.cairo file."""
        # Run CLI with custom output dir
        result = subprocess.run(
            [
                "python", "-m", "hydra.compilable_circuits.regenerate",
                "ntt",
                "--n", "8",
                "--output-dir", str(tmp_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        assert result.returncode == 0, f"CLI failed: {result.stderr}"

        output_file = tmp_path / "ntt_bounded_int.cairo"
        assert output_file.exists(), "Output file not created"

        content = output_file.read_text()
        assert "pub fn ntt_8(" in content
        assert "ntt_8_inner" in content
```

**Step 9.2: Run test to verify it fails**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestRegenerateCli -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 9.3: Create regenerate.py**

```python
# hydra/compilable_circuits/regenerate.py
"""
CLI for regenerating compilable circuits.

Usage:
    python -m hydra.compilable_circuits.regenerate ntt
    python -m hydra.compilable_circuits.regenerate ntt --n 512 --output-dir packages/falcon/src
"""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Regenerate compilable circuits",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python -m hydra.compilable_circuits.regenerate ntt
    python -m hydra.compilable_circuits.regenerate ntt --n 512
    python -m hydra.compilable_circuits.regenerate all
        """,
    )
    parser.add_argument(
        "circuit",
        choices=["ntt", "intt", "all"],
        help="Which circuit to regenerate",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=512,
        help="Transform size (default: 512)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="packages/falcon/src",
        help="Output directory (default: packages/falcon/src)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.circuit in ("ntt", "all"):
        from .ntt import NttCircuitGenerator

        gen = NttCircuitGenerator(args.n)
        code = gen.generate_full()

        output_file = output_dir / "ntt_bounded_int.cairo"
        output_file.write_text(code)

        stats = gen.circuit.stats()
        print(f"Generated {output_file}")
        print(f"  Size: n={args.n}")
        print(f"  Operations: {stats['num_operations']}")
        print(f"  Types: {stats['num_types']}")

    # Future: intt
    if args.circuit == "intt":
        print("INTT generation not yet implemented")


if __name__ == "__main__":
    main()
```

**Step 9.4: Run test**

Run: `pytest tests/compilable_circuits/test_ntt.py::TestRegenerateCli -v`
Expected: PASS

**Step 9.5: Commit**

```bash
git add hydra/compilable_circuits/regenerate.py tests/compilable_circuits/test_ntt.py
git commit -m "feat: add regeneration CLI for compilable circuits"
```

---

## Task 10: Generate and Test Full ntt_512

**Files:**
- Create: `packages/falcon/src/ntt_bounded_int.cairo`
- Create: `packages/falcon/src/tests/test_ntt_bounded_int.cairo`

**Step 10.1: Generate ntt_512 Cairo code**

Run: `python -m hydra.compilable_circuits.regenerate ntt --n 512 --output-dir packages/falcon/src`
Expected: File created with ~7000+ operations

**Step 10.2: Verify generation statistics**

Run: `wc -l packages/falcon/src/ntt_bounded_int.cairo`
Expected: Large file (likely 8000+ lines)

**Step 10.3: Verify scarb build compiles**

Run: `cd packages/falcon && scarb build`
Expected: BUILD SUCCESSFUL

**Step 10.4: Write Cairo test for ntt_512**

Create `packages/falcon/src/tests/test_ntt_bounded_int.cairo`:

```cairo
// packages/falcon/src/tests/test_ntt_bounded_int.cairo
use falcon::ntt::{ntt};
use falcon::ntt_bounded_int::{ntt_512};
use falcon::zq::{Zq, from_u16, to_u16};

#[test]
fn test_ntt_512_matches_recursive() {
    // Test vector: [1, 2, 3, ..., 512]
    let mut f_array: Array<Zq> = array![];
    let mut f_u16: Array<u16> = array![];

    let mut i: u16 = 1;
    while i <= 512 {
        f_array.append(from_u16(i));
        f_u16.append(i);
        i += 1;
    };

    // Reference: existing recursive ntt
    let expected = ntt(f_u16.span());

    // Generated: BoundedInt ntt_512
    let actual = ntt_512(f_array);

    // Compare all 512 elements
    let mut i: usize = 0;
    while i < 512 {
        assert_eq!(to_u16(*actual[i]), *expected[i]);
        i += 1;
    };
}

#[test]
fn test_ntt_512_all_zeros() {
    let mut f: Array<Zq> = array![];
    let mut i: usize = 0;
    while i < 512 {
        f.append(from_u16(0));
        i += 1;
    };

    let result = ntt_512(f);

    // NTT of all zeros should be all zeros
    let mut i: usize = 0;
    while i < 512 {
        assert_eq!(to_u16(*result[i]), 0);
        i += 1;
    };
}
```

**Step 10.5: Run Cairo tests**

Run: `cd packages/falcon && scarb test -f test_ntt_512`
Expected: PASS

**Step 10.6: Commit**

```bash
git add packages/falcon/src/ntt_bounded_int.cairo packages/falcon/src/tests/test_ntt_bounded_int.cairo
git commit -m "feat: generate and test ntt_512 using BoundedInt circuit"
```

---

## Task 11: Add lib.cairo Module Declaration

**Files:**
- Modify: `packages/falcon/src/lib.cairo`

**Step 11.1: Check current lib.cairo structure**

Run: `cat packages/falcon/src/lib.cairo`
Expected: See current module declarations

**Step 11.2: Add ntt_bounded_int module**

Add to `packages/falcon/src/lib.cairo`:

```cairo
mod ntt_bounded_int;
```

**Step 11.3: Verify build**

Run: `cd packages/falcon && scarb build`
Expected: BUILD SUCCESSFUL

**Step 11.4: Run full test suite**

Run: `cd packages/falcon && scarb test`
Expected: ALL PASS

**Step 11.5: Commit**

```bash
git add packages/falcon/src/lib.cairo
git commit -m "feat: expose ntt_bounded_int module in lib.cairo"
```

---

## Task 12: Final Verification and Edge Case Tests

**Files:**
- Modify: `tests/compilable_circuits/test_ntt.py`
- Modify: `packages/falcon/src/tests/test_ntt_bounded_int.cairo`

**Step 12.1: Add Python edge case tests**

Add to `tests/compilable_circuits/test_ntt.py`:

```python
class TestEdgeCases:
    """Test edge cases for NTT generation."""

    def test_all_zeros(self):
        """NTT of all zeros should be all zeros."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        for n in [2, 4, 8, 16]:
            gen = NttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._ntt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [0] * n
            expected = reference_ntt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected == [0] * n

    def test_all_max_values(self):
        """NTT handles all inputs at Q-1."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        for n in [2, 4, 8]:
            gen = NttCircuitGenerator(n=n)
            gen._register_constants()

            inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
            result = gen._ntt(inputs)

            for i, out in enumerate(result):
                gen.circuit.output(out.reduce(), f"r{i}")

            test_input = [gen.Q - 1] * n
            expected = reference_ntt(test_input[:])
            actual = gen.simulate(test_input[:])

            assert actual == expected

    def test_alternating_pattern(self):
        """NTT handles alternating 0, Q-1 pattern."""
        from hydra.falcon_py.ntt import ntt as reference_ntt

        n = 8
        gen = NttCircuitGenerator(n=n)
        gen._register_constants()

        inputs = [gen.circuit.input(f"f{i}", 0, gen.Q - 1) for i in range(n)]
        result = gen._ntt(inputs)

        for i, out in enumerate(result):
            gen.circuit.output(out.reduce(), f"r{i}")

        test_input = [0 if i % 2 == 0 else gen.Q - 1 for i in range(n)]
        expected = reference_ntt(test_input[:])
        actual = gen.simulate(test_input[:])

        assert actual == expected
```

**Step 12.2: Run all tests**

Run: `pytest tests/compilable_circuits/ -v`
Expected: ALL PASS

**Step 12.3: Add Cairo boundary test**

Add to `packages/falcon/src/tests/test_ntt_bounded_int.cairo`:

```cairo
#[test]
fn test_ntt_512_boundary_values() {
    // All elements at Q-1 = 12288
    let mut f: Array<Zq> = array![];
    let mut f_u16: Array<u16> = array![];

    let mut i: usize = 0;
    while i < 512 {
        f.append(from_u16(12288));
        f_u16.append(12288);
        i += 1;
    };

    // Reference
    let expected = ntt(f_u16.span());

    // Generated
    let actual = ntt_512(f);

    // Compare
    let mut i: usize = 0;
    while i < 512 {
        assert_eq!(to_u16(*actual[i]), *expected[i]);
        i += 1;
    };
}
```

**Step 12.4: Run Cairo tests**

Run: `cd packages/falcon && scarb test`
Expected: ALL PASS

**Step 12.5: Final commit**

```bash
git add tests/compilable_circuits/test_ntt.py packages/falcon/src/tests/test_ntt_bounded_int.cairo
git commit -m "test: add edge case tests for NTT generator and Cairo"
```

---

## Summary

**Files Created:**
- `hydra/compilable_circuits/__init__.py`
- `hydra/compilable_circuits/ntt.py`
- `hydra/compilable_circuits/regenerate.py`
- `tests/compilable_circuits/__init__.py`
- `tests/compilable_circuits/conftest.py`
- `tests/compilable_circuits/test_ntt.py`
- `packages/falcon/src/ntt_bounded_int.cairo` (generated)
- `packages/falcon/src/tests/test_ntt_bounded_int.cairo`

**Files Modified:**
- `packages/falcon/src/lib.cairo`

**Expected Statistics for n=512:**
- Input variables: 512
- Output variables: 512
- Butterfly operations: 2304 (256 × 9 stages)
- Total operations: ~7000-9000
- Generated code size: ~100-200 KB
