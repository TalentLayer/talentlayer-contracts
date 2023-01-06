// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/ITalentLayerID.sol";
import "./interfaces/ISocialPlatform.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Lens is ISocialPlatform {
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
     * @notice Instance of TalentLayerID.sol
     */
    ITalentLayerID private talentLayerIdContract;

    string socialPlatformName = "Lens";

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     * @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     */
    constructor(address _talentLayerIDAddress) {
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
    }

    // =========================== User functions ==============================

    // Link the Lens ID to the TalentLayer ID

    /**
     * @dev Called on contract deployment
     * @param _LensId Social platform Id ID
     * @param _talentLayerId TalentLayer ID
     */
    function setExternalIdMapping(bytes32 _LensId, uint256 _talentLayerId) external onlyOwner {
        // get the Talent Layer id from the wallet
        _talentLayerId = talentLayerIdContract.walletOfOwner(msg.sender);

        // check if the Talent Layer id is valid
        talentLayerIdContract.isValid(_talentLayerId);

        // store the mapping in Lens contract
        lensToTalentLayerId[_LensId] = _talentLayerId;

        // we store the mapping in the TalentLayerID contract
        talentLayerIdContract.setSocialId(socialPlatformName, _LensId);

        // emit event
        emit LensLink(_LensId, _talentLayerId);
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
