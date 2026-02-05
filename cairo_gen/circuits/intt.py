# cairo_gen/circuits/intt.py
"""
INTT circuit generator for Falcon-512.

Generates fully-unrolled Cairo intt_512 function using BoundedIntCircuit.
"""
from cairo_gen import BoundedIntCircuit
from cairo_gen.circuit import BoundedIntVar
from falcon_py.ntt_constants import roots_dict_Zq, inv_mod_q


class InttCircuitGenerator:
    """Generate INTT circuits using BoundedIntCircuit DSL."""

    Q = 12289
    I2 = 6145  # inverse of 2 mod Q
    SQR1 = roots_dict_Zq[2][0]  # = 1479, sqrt(-1) mod Q
    INV_SQR1 = inv_mod_q[SQR1]  # inverse of sqrt(-1) mod Q

    def __init__(self, n: int = 512):
        """
        Initialize generator for INTT of size n.

        Args:
            n: Transform size (must be power of 2, max 1024)
        """
        if n & (n - 1) != 0 or n < 2 or n > 1024:
            raise ValueError(f"n must be power of 2 in [2, 1024], got {n}")
        self.n = n
        self.circuit = BoundedIntCircuit(f"intt_{n}_inner", modulus=self.Q)

    def _register_constants(self) -> None:
        """Register all constants needed for INTT."""
        # I2 for scaling
        self.circuit.register_constant(self.I2, "I2")

        # INV_SQR1 for base case
        self.circuit.register_constant(self.INV_SQR1, "INV_SQR1")

        # Q for modular reduction
        self.circuit.register_constant(self.Q, "Q")

        # Register inverse roots for each split level
        # For split at size `size`, we need inv_mod_q[roots[2*i]]
        size = 4
        while size <= self.n:
            roots = roots_dict_Zq[size]
            # Even indices only: inv of roots[0], roots[2], roots[4], ...
            for i in range(0, len(roots), 2):
                root_value = roots[i]
                inv_root_value = inv_mod_q[root_value]
                inv_root_name = f"INV_W{size}_{i // 2}"
                if inv_root_value not in self.circuit.constants:
                    self.circuit.register_constant(inv_root_value, inv_root_name)
            size *= 2

    def _intt_base_case(self, f0: BoundedIntVar, f1: BoundedIntVar) -> list[BoundedIntVar]:
        """
        INTT base case for n=2.

        Computes:
            r0 = i2 * (f0 + f1) mod Q
            r1 = i2 * inv_sqr1 * (f0 - f1) mod Q

        Returns unreduced results (caller should reduce).
        """
        i2 = self.circuit.constant(self.I2, "i2")
        inv_sqr1 = self.circuit.constant(self.INV_SQR1, "inv_sqr1")

        # f0 + f1, f0 - f1
        sum_01 = f0 + f1
        diff_01 = f0 - f1

        # r0 = i2 * sum
        r0 = i2 * sum_01

        # r1 = i2 * inv_sqr1 * diff
        diff_scaled = inv_sqr1 * diff_01
        r1 = i2 * diff_scaled

        return [r0, r1]

    def _merge(self, f0: list, f1: list) -> list:
        """
        Merge (interleave) two coefficient lists.

        This is a compile-time operation on the coefficient list,
        not a circuit operation.
        """
        result = []
        for i in range(len(f0)):
            result.append(f0[i])
            result.append(f1[i])
        return result

    def _split_ntt(
        self,
        f_ntt: list[BoundedIntVar],
        size: int
    ) -> tuple[list[BoundedIntVar], list[BoundedIntVar]]:
        """
        Split NTT representation using inverse butterflies.

        For i in [0, size/2):
            f0_ntt[i] = i2 * (f_ntt[2*i] + f_ntt[2*i+1])
            f1_ntt[i] = i2 * (f_ntt[2*i] - f_ntt[2*i+1]) * inv_w[2*i]

        where inv_w = inv_mod_q[roots_dict_Zq[size]].

        Returns unreduced results.
        """
        roots = roots_dict_Zq[size]
        i2 = self.circuit.constant(self.I2, "i2")
        f0_ntt = []
        f1_ntt = []

        half = len(f_ntt) // 2
        for i in range(half):
            even = f_ntt[2 * i]
            odd = f_ntt[2 * i + 1]

            # Get inverse twiddle factor
            twiddle_value = roots[2 * i]
            inv_twiddle_value = inv_mod_q[twiddle_value]
            inv_twiddle = self.circuit.constant(inv_twiddle_value, f"inv_w{size}_{i}")

            # sum = even + odd
            sum_eo = even + odd

            # diff = even - odd
            diff_eo = even - odd

            # f0_ntt[i] = i2 * sum
            f0_ntt.append(i2 * sum_eo)

            # f1_ntt[i] = i2 * diff * inv_twiddle
            diff_scaled = diff_eo * inv_twiddle
            f1_ntt.append(i2 * diff_scaled)

        return f0_ntt, f1_ntt

    def _intt(self, f_ntt: list[BoundedIntVar]) -> list[BoundedIntVar]:
        """
        Recursive INTT - operations are traced into circuit.

        For n=2: base case with I2 and INV_SQR1
        For n>2: split_ntt -> recurse on halves -> merge (interleave)

        Returns unreduced results.
        """
        n = len(f_ntt)

        if n == 2:
            return self._intt_base_case(f_ntt[0], f_ntt[1])
        else:
            # Split in NTT domain (inverse butterfly)
            f0_ntt, f1_ntt = self._split_ntt(f_ntt, n)

            # Recursive INTT on each half
            f0 = self._intt(f0_ntt)
            f1 = self._intt(f1_ntt)

            # Merge in coefficient domain (just interleave)
            return self._merge(f0, f1)

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

    def generate(self, mode: str = "felt252") -> str:
        """
        Build circuit and compile to Cairo.

        Args:
            mode: Compilation mode - "bounded" or "felt252".

        Returns:
            Cairo source code for the inner function.
        """
        # Reset circuit for fresh generation
        self.circuit = BoundedIntCircuit(f"intt_{self.n}_inner", modulus=self.Q)
        self._register_constants()

        # Create inputs (NTT coefficients)
        inputs = [
            self.circuit.input(f"f{i}", 0, self.Q - 1)
            for i in range(self.n)
        ]

        # Run INTT (traces all operations)
        outputs = self._intt(inputs)

        # Mark outputs with reduction
        for i, out in enumerate(outputs):
            self.circuit.output(out.reduce(), f"r{i}")

        # Print summary before compiling so bounds are visible
        self.circuit.print_summary()

        # Generate Cairo code
        return self.circuit.compile(mode=mode)

    def generate_full(self, mode: str = "felt252") -> str:
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
            - Inner function (intt_N_inner with N separate params)
            - Public wrapper (intt_N taking Array<felt252>)
        """
        # Generate inner function code
        inner_code = self.generate(mode=mode)

        # Build header
        header = """// Auto-generated by cairo_gen/circuits/intt.py
// DO NOT EDIT MANUALLY - regenerate with: python -m cairo_gen.circuits.regenerate intt

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

        Args:
            elem_type: Element type for arrays ("Zq" or "felt252").

        Returns:
            Cairo wrapper function code.
        """
        n = self.n

        # Parameter names for multi_pop_front destructuring
        param_names = ", ".join(f"f{i}" for i in range(n))

        # Arguments to inner function call
        inner_args = ", ".join(f"f{i}" for i in range(n))

        # Output names from inner function
        output_names = ", ".join(f"r{i}" for i in range(n))

        # Array construction
        array_items = ", ".join(f"r{i}" for i in range(n))

        return f"""
/// INTT of size {n} using Array<{elem_type}> interface.
pub fn intt_{n}(mut f: Array<{elem_type}>) -> Array<{elem_type}> {{
    let mut f_span = f.span();
    let boxed = f_span.multi_pop_front::<{n}>().expect('expected {n} elements');
    let [{param_names}] = boxed.unbox();

    let ({output_names}) = intt_{n}_inner({inner_args});

    array![{array_items}]
}}
"""
