// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/ITalentLayerID.sol";
import "./interfaces/ISocialPlatform.sol";
import "./interfaces/ILensHub.sol";
import "./libs/IERC721Time.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lens is ISocialPlatform, Ownable {
    // =========================== Events ==============================
    /// @notice Emitted after a link between a Lens ID and a TalentLayer ID is created
    /// @param _lensId the lensId
    /// @param _talentLayerId the talentLayerId

    event LensLink(bytes32 _lensId, uint256 _talentLayerId);

    // =========================== Mappings ==============================
    // Add a mapping to associate Lens Handke with TalentLayer IDs
    mapping(string => uint256) public lensToTalentLayerId;

    // =========================== Declaration ==============================

    /**
     * @notice Instance of TalentLayerID.sol
     */
    ITalentLayerID private talentLayerIdContract;

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

    // =========================== Constructor ==============================

    // Do we have to pass the address of the TalentLayerID contract in the constructor or in the setExternalIdMapping function ?
    /**
     * @dev Called on contract deployment
     * @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     */
    constructor(address _talentLayerIDAddress, address payable _proxyAddress) {
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
        iLensHub = ILensHub(_proxyAddress);
    }

    // =========================== User functions ==============================

    // Link the Lens ID to the TalentLayer ID

    /**
     * @dev Called on contract deployment
     * @param _socialHandle Social platform handle => handle.lens
     * @param _talentLayerId TalentLayer ID
     */
    function setExternalIdMapping(string memory _socialHandle, uint256 _talentLayerId) external onlyOwner {
        // get the Talent Layer id from the wallet
        _talentLayerId = talentLayerIdContract.walletOfOwner(msg.sender);

        //We first get the Profile with the handle (getProfileByHandle) with kyubi.test we should get 25017
        uint256 profileId = iLensHub.getProfileIdByHandle(_socialHandle);

        // then we check the owner address of the profile (ownerOf) with 25017 we should get 0x3Fba71369E5E2E947AE2320274b1677de7D28120
        //address ownerAddress = IERC721Time.ownerOf(profileId);

        // check if the Talent Layer id is valid
        talentLayerIdContract.isValid(_talentLayerId);

        // store the mapping in Lens contract
        lensToTalentLayerId[_socialHandle] = _talentLayerId;

        // we store the mapping in the TalentLayerID contract
        talentLayerIdContract.setSocialId(socialPlatformName, _socialHandle);

        // emit event
        emit LensLink(_socialHandle, _talentLayerId);
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
