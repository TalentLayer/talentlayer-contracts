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

    address constant _proxyAddress = 0x60Ae865ee4C725cd04353b5AAb364553f56ceF82;

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     */
    constructor() {
        iLensHub = ILensHub(_proxyAddress);
    }

    // =========================== User functions ============================

    // we check with the user address if the user is registered on the platform
    function isRegistered(address _userAddress) external view returns (bool, bytes memory) {
        // convert the address to bytes
        bytes memory _userExtrenalId = abi.encodePacked(_userAddress);

        if (iLensHub.defaultProfile(_userAddress) > 0) {
            return (true, _userExtrenalId);
        } else {
            return (false, "User is not registered");
        }
    }
}
