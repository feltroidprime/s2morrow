# cairo_gen/circuits/ntt.py
"""
NTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo ntt_512 function using BoundedIntCircuit.
"""
from cairo_gen import BoundedIntCircuit
from cairo_gen.circuit import BoundedIntVar
from falcon_py.ntt_constants import roots_dict_Zq


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

    def generate(self, mode: str = "bounded") -> str:
        """
        Build circuit and compile to Cairo.

        Args:
            mode: Compilation mode - "bounded" or "felt252".

        Returns:
            Cairo source code for the inner function.
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

        # Print summary before compiling so bounds are visible
        self.circuit.print_summary()

        # Generate Cairo code
        return self.circuit.compile(mode=mode)

    def generate_full(self, mode: str = "bounded") -> str:
        """
        Generate complete Cairo file with inner function and public wrapper.

        Args:
            mode: Compilation mode - "bounded" or "felt252".

        Returns:
            Complete Cairo source file with:
            - Auto-generated header
            - All imports
            - Type definitions
            - Helper impls
            - Inner function (ntt_N_inner with N separate params)
            - Public wrapper (ntt_N taking Array<Zq> or Array<felt252>)
        """
        # Generate inner function code
        inner_code = self.generate(mode=mode)

        # Build header
        header = """// Auto-generated by cairo_gen/circuits/ntt.py
// DO NOT EDIT MANUALLY - regenerate with: python -m cairo_gen.circuits.regenerate ntt

"""

        # Determine element type based on mode
        if mode == "felt252":
            elem_type = "felt252"
        else:
            elem_type = "Zq"

        # Build public wrapper
        wrapper = self._generate_wrapper(elem_type)

        return header + inner_code + wrapper

    def _generate_wrapper(self, elem_type: str) -> str:
        """
        Generate the public wrapper function.

        In felt252 mode, the wrapper takes Span<Zq> and upcasts to felt252
        when calling the inner function. Returns Array<Zq>.

        Args:
            elem_type: Element type for arrays ("Zq" or "felt252").

        Returns:
            Cairo wrapper function code.
        """
        n = self.n

        # Parameter names for multi_pop_front destructuring
        param_names = ", ".join(f"f{i}" for i in range(n))

        # Output names from inner function
        output_names = ", ".join(f"r{i}" for i in range(n))

        # Array construction
        array_items = ", ".join(f"r{i}" for i in range(n))

        # In felt252 mode, input is Zq with upcast to felt252 for inner call
        if elem_type == "felt252":
            input_type = "Zq"
            output_type = "Zq"
            inner_args = ", ".join(f"upcast(f{i})" for i in range(n))
        else:
            input_type = elem_type
            output_type = elem_type
            inner_args = ", ".join(f"f{i}" for i in range(n))

        return f"""
/// NTT of size {n} — accepts Span<{input_type}>, returns Array<{output_type}>.
pub fn ntt_{n}(mut f: Span<{input_type}>) -> Array<{output_type}> {{
    let boxed = f.multi_pop_front::<{n}>().expect('expected {n} elements');
    let [{param_names}] = boxed.unbox();

    let ({output_names}) = ntt_{n}_inner({inner_args});

    array![{array_items}]
}}
"""
