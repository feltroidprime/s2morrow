# cairo_gen/circuits/regenerate.py
"""
CLI for regenerating compilable circuits.

Usage:
    python -m cairo_gen.circuits.regenerate ntt
    python -m cairo_gen.circuits.regenerate ntt --n 512 --output-dir packages/falcon/src
"""
import argparse
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Regenerate compilable circuits",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python -m cairo_gen.circuits.regenerate ntt
    python -m cairo_gen.circuits.regenerate ntt --n 512
    python -m cairo_gen.circuits.regenerate all
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
    parser.add_argument(
        "--mode",
        choices=["bounded", "felt252"],
        default="felt252",
        help="Compilation mode: 'bounded' for BoundedInt types, 'felt252' for native arithmetic (default)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.circuit in ("ntt", "all"):
        from .ntt import NttCircuitGenerator

        gen = NttCircuitGenerator(args.n)
        code = gen.generate_full(mode=args.mode)

        if args.mode == "felt252":
            output_file = output_dir / "ntt_felt252.cairo"
        else:
            output_file = output_dir / "ntt_bounded_int.cairo"
        output_file.write_text(code)

        # Try to format, but don't fail if scarb fmt fails (e.g., file not in workspace)
        result = subprocess.run(["scarb", "fmt", str(output_file)], capture_output=True)
        if result.returncode != 0:
            print(f"Warning: scarb fmt failed (file may not be in a workspace)")

        stats = gen.circuit.stats()
        print(f"Generated {output_file}")
        print(f"\tStats: {stats}")



    if args.circuit in ("intt", "all"):
        from .intt import InttCircuitGenerator

        gen = InttCircuitGenerator(args.n)
        code = gen.generate_full(mode=args.mode)

        if args.mode == "felt252":
            output_file = output_dir / "intt_felt252.cairo"
        else:
            output_file = output_dir / "intt_bounded_int.cairo"
        output_file.write_text(code)

        # Try to format, but don't fail if scarb fmt fails (e.g., file not in workspace)
        result = subprocess.run(["scarb", "fmt", str(output_file)], capture_output=True)
        if result.returncode != 0:
            print(f"Warning: scarb fmt failed (file may not be in a workspace)")

        stats = gen.circuit.stats()
        print(f"Generated {output_file}")
        print(f"\tStats: {stats}")


if __name__ == "__main__":
    main()
