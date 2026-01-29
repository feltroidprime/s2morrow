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
