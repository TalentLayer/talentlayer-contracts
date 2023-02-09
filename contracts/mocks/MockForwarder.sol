// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title MockForwarder
 * @dev A mock implementation of a Forwarder based on Open GSN Forwarder.
 */
contract MockForwarder {
    /**
     * @notice A representation of a request for a `Forwarder` to send `data` on behalf of a `from` to a target (`to`).
     */
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 validUntilTime;
    }

    function execute(ForwardRequest calldata req) external payable returns (bool success, bytes memory ret) {
        bytes memory callData = abi.encodePacked(req.data, req.from);
        (success, ret) = req.to.call{gas: req.gas, value: req.value}(callData);

        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        return (success, ret);
    }
}
