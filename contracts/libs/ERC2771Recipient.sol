// SPDX-License-Identifier: MIT
pragma solidity >=0.6.9;

import {IERC2771Recipient} from "@opengsn/contracts/src/interfaces/IERC2771Recipient.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

abstract contract ERC2771Recipient is IERC2771Recipient, Ownable {

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
    }

    /**
     * Allows the owner to remove a trusted forwarder.
     * @param _forwarder The address of the forwarder.
     */
    function removeTrustedForwarder(address _forwarder) external onlyOwner {
        _trustedForwarders[_forwarder] = false;
    }

    /// @inheritdoc IERC2771Recipient
    function isTrustedForwarder(address forwarder) public virtual override view returns(bool) {
        return _trustedForwarders[forwarder];
    }

    /// @inheritdoc IERC2771Recipient
    function _msgSender() internal override(Context, IERC2771Recipient) virtual view returns (address ret) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // At this point we know that the sender is a trusted forwarder,
            // so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            assembly {
                ret := shr(96,calldataload(sub(calldatasize(),20)))
            }
        } else {
            ret = msg.sender;
        }
    }

    /// @inheritdoc IERC2771Recipient
    function _msgData() internal override(Context, IERC2771Recipient) virtual view returns (bytes calldata ret) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            return msg.data[0:msg.data.length-20];
        } else {
            return msg.data;
        }
    }
}
