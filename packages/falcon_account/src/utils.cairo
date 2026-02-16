/// Minimum transaction version for invoke transactions.
pub const MIN_TRANSACTION_VERSION: u256 = 1;

/// Query offset for simulation transactions.
pub const QUERY_OFFSET: u256 = 0x100000000000000000000000000000000;

/// Validates that the current transaction version is supported.
/// Regular transactions must be >= MIN_TRANSACTION_VERSION.
/// Simulation transactions (version >= QUERY_OFFSET) must be >= QUERY_OFFSET +
/// MIN_TRANSACTION_VERSION.
pub fn is_tx_version_valid() -> bool {
    let tx_info = starknet::get_tx_info().unbox();
    let tx_version: u256 = tx_info.version.into();
    if tx_version >= QUERY_OFFSET {
        QUERY_OFFSET + MIN_TRANSACTION_VERSION <= tx_version
    } else {
        MIN_TRANSACTION_VERSION <= tx_version
    }
}
