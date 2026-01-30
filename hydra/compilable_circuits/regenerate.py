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
