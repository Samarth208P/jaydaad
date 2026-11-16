// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Installed only in the ephemeral Hardhat network. Never deploy this as a verifier.
contract DianaFixture {
    mapping(address => bytes) private keys;
    mapping(bytes32 => bool) private approvals;
    function enroll(address who, bytes calldata key) external { keys[who] = key; }
    function pqcKeyStatus(address who) external view returns (bool, uint8, bytes memory, bool) {
        bool exists = keys[who].length != 0;
        return (exists, 1, keys[who], exists);
    }
    function record(bytes calldata key, bytes calldata signature, bytes calldata message) external {
        approvals[keccak256(abi.encode(key, signature, message))] = true;
    }
    function pqcVerify(bytes calldata key, bytes calldata signature, bytes calldata message) external view returns (bool) {
        return approvals[keccak256(abi.encode(key, signature, message))];
    }
}
