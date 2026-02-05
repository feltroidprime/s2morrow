# tests/bounded_int_circuit/test_variable.py
import pytest
from cairo_gen import BoundedIntCircuit, BoundedIntVar


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
