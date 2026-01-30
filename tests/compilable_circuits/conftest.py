# tests/compilable_circuits/conftest.py
import os
import pytest
import subprocess
import tempfile
import shutil
from pathlib import Path

# Use scarb 2.15.1 for better dependency resolution
SCARB_ENV = {**os.environ, "ASDF_SCARB_VERSION": "2.15.1"}


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

        # Run scarb build with specific version
        result = subprocess.run(
            ["scarb", "build"],
            cwd=tmpdir,
            capture_output=True,
            text=True,
            timeout=60,
            env=SCARB_ENV,
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
