// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IStrategies.sol";
import "./interfaces/ILensHub.sol";
import "./libs/IERC721Time.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lens is IStrategies, Ownable {
    // =========================== Events ==============================
    /// @notice Emitted after a link between a Lens ID and a TalentLayer ID is created
    /// @param _lensId the lensId
    /// @param _talentLayerId the talentLayerId

    event LensLink(bytes32 _lensId, uint256 _talentLayerId);

    // =========================== Mappings ==============================
    // Add a mapping to associate Lens IDs with TalentLayer IDs
    mapping(bytes32 => uint256) public lensToTalentLayerId;

    // =========================== Declaration ==============================

    /**
     * @notice Instance of ILensHub.sol
     */
    ILensHub private iLensHub;

    /**
     * @notice Instance of IERC721Time.sol
     */
    IERC721Time private iERC721Time;

    string constant socialPlatformName = "Lens";

    address constant _proxyAddress = 0x60Ae865ee4C725cd04353b5AAb364553f56ceF82;

    // =========================== Event ====================================

    event StratInfo(bytes32 _stratId, uint256 _stratType);

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     * @param _proxyAddress LensHub proxy address
     */
    constructor(address payable _proxyAddress) {
        iLensHub = ILensHub(_proxyAddress);
    }

    // =========================== User functions ============================

    // we check with the user address if the user is registered on the platform
    function isRegistered(address _user) external view {}

    // We get the Strat Id from the platform partner
    function getStratInfo(address _user) public view returns (bytes32) {
        // we can store it in a mapping in Lens contract ?? could be useful for Lens maybe ?

        // do we need
        emit StratInfo();
    }

    // =========================== View functions ==============================

    /**
     * @dev Called on contract deployment
     * @param _lensId Lens ID
     */
    function getTalentLayerIdWithLensID(bytes32 _lensId) public view returns (uint256) {
        return lensToTalentLayerId[_lensId];
    }
}
