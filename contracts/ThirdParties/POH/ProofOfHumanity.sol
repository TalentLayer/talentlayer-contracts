// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../../interfaces/IThirdPartyID.sol";
import "./ILensHub.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProofOfHumanity is IThirdPartyID, Ownable {
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

    /**
     * @dev check if the user is registered
     * @param _userAddress address of the user
     */
    function isRegistered(address _userAddress) external view returns (bool, bytes memory) {
        //ROMAIN check
        require(iLensHub.defaultProfile(_userAddress) != uint256(0), "User not registered");

        bytes memory _userThirdPartyId = abi.encode(iLensHub.defaultProfile(_userAddress));

        if (_userThirdPartyId.length > 0) {
            return (true, _userThirdPartyId);
        } else {
            return (false, _userThirdPartyId);
        }
    }
}
