// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../../interfaces/IExternalID.sol";
import "./ILensHub.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LensID is IExternalID, Ownable {
    // =========================== Declaration ==============================

    /**
     * @notice Instance of ILensHub.sol
     */
    ILensHub private iLensHub;

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     */
    constructor(address _proxyAddress) {
        iLensHub = ILensHub(_proxyAddress);
    }

    // =========================== User functions ============================

    // we check with the user address if the user is registered on the platform
    function isRegistered(address _userAddress) external view returns (bool, bytes memory) {
        // convert the address to bytes
        bytes memory _userExtrenalId = abi.encode(iLensHub.defaultProfile(_userAddress));

        if (_userExtrenalId.length > 0) {
            return (true, _userExtrenalId);
        } else {
            return (false, _userExtrenalId);
        }
    }
}
