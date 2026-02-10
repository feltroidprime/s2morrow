"""Generate INTT test data for Cairo tests.

Reads the NTT input from ntt_input_512_int.json, computes NTT and INTT
using the Python reference implementation, and saves two JSON files:
- intt_input_512_int.json: NTT-domain values (input to INTT)
- intt_expected_512_int.json: coefficient-domain values (expected INTT output / hint)
"""

import json
import sys
import os

# Add falcon_py to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'falcon_py'))

from ntt import ntt, intt

def main():
    # Load the same input used by existing NTT tests
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    with open(os.path.join(data_dir, 'ntt_input_512_int.json')) as f:
        data = json.load(f)

    # Extract the 512 values (skip the length header at index 0)
    raw = data['input']
    assert raw[0] == 512, f"Expected header 512, got {raw[0]}"
    coeffs = raw[1:]  # 512 values
    assert len(coeffs) == 512, f"Expected 512 values, got {len(coeffs)}"

    # Compute NTT of the input
    ntt_output = ntt(coeffs)
    assert len(ntt_output) == 512

    # Compute INTT to get back the coefficients (this is our expected hint)
    intt_result = intt(ntt_output)
    assert len(intt_result) == 512

    # Verify roundtrip
    assert intt_result == coeffs, "Roundtrip NTT->INTT failed!"

    # Save NTT output as INTT input (with 512 header for snforge Serde format)
    intt_input_data = {"input": [512] + ntt_output}
    with open(os.path.join(data_dir, 'intt_input_512_int.json'), 'w') as f:
        json.dump(intt_input_data, f)

    # Save original coefficients as expected INTT output (the hint)
    intt_expected_data = {"input": [512] + intt_result}
    with open(os.path.join(data_dir, 'intt_expected_512_int.json'), 'w') as f:
        json.dump(intt_expected_data, f)

    print(f"Generated {os.path.join(data_dir, 'intt_input_512_int.json')}")
    print(f"Generated {os.path.join(data_dir, 'intt_expected_512_int.json')}")
    print(f"NTT output sample: {ntt_output[:5]}")
    print(f"INTT result sample: {intt_result[:5]}")

if __name__ == '__main__':
    main()
