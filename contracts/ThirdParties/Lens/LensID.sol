// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../../interfaces/IThirdPartyID.sol";
import "./ILensHub.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LensID is IThirdPartyID, Ownable {
    // =========================== Declaration ==============================

    /**
     * @notice Instance of ILensHub.sol
     */
    ILensHub private lensHub;

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     */
    constructor(address _address) {
        lensHub = ILensHub(_address);
    }

    // =========================== User functions ============================

    /**
     * @dev check if the user is registered
     * @param _userAddress address of the user
     */
    function isRegistered(address _userAddress) external view returns (bool, bytes memory) {
        uint256 userThirdPartyId = lensHub.defaultProfile(_userAddress);

        if (userThirdPartyId > 0) {
            return (true, abi.encode(userThirdPartyId));
        } else {
            return (false, bytes(""));
        }
    }
}
