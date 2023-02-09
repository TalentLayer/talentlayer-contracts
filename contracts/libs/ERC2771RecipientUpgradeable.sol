// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC2771Recipient} from "@opengsn/contracts/src/interfaces/IERC2771Recipient.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ERC2771RecipientUpgradeable
 * @dev Based on ERC2771Recipient from OpenGSN, but adding support for multiple forwarders.
 *      To be used with upgradeable contracts.
 */
abstract contract ERC2771RecipientUpgradeable is IERC2771Recipient, OwnableUpgradeable {
    /**
     * Emitted when a new trusted forwarder is added.
     * @param forwarder The address of the forwarder.
     */
    event TrustedForwarderAdded(address forwarder);

    /**
     * Emitted when a trusted forwarder is removed.
     * @param forwarder The address of the forwarder.
     */
    event TrustedForwarderRemoved(address forwarder);

    /*
     * Trusted forwarders we accept calls from
     */
    mapping(address => bool) private _trustedForwarders;

    /**
     * Allows the owner to add a trusted forwarder.
     * @param _forwarder The address of the forwarder.
     */
    function addTrustedForwarder(address _forwarder) external onlyOwner {
        _trustedForwarders[_forwarder] = true;
        emit TrustedForwarderAdded(_forwarder);
    }

    /**
     * Allows the owner to remove a trusted forwarder.
     * @param _forwarder The address of the forwarder.
     */
    function removeTrustedForwarder(address _forwarder) external onlyOwner {
        _trustedForwarders[_forwarder] = false;
        emit TrustedForwarderRemoved(_forwarder);
    }

    /// @inheritdoc IERC2771Recipient
    function isTrustedForwarder(address forwarder) public view virtual override returns (bool) {
        return _trustedForwarders[forwarder];
    }

    /// @inheritdoc IERC2771Recipient
    function _msgSender() internal view virtual override(ContextUpgradeable, IERC2771Recipient) returns (address ret) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // At this point we know that the sender is a trusted forwarder,
            // so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            assembly {
                ret := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            ret = msg.sender;
        }
    }

    /// @inheritdoc IERC2771Recipient
    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, IERC2771Recipient)
        returns (bytes calldata ret)
    {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            return msg.data[0:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }
}
