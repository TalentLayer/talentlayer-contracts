// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Concrete implementation of PartnershipContract for the Bloup platform

interface ISocialPlatform {
    function setExternalIdMapping(bytes32 _LensId, uint256 _talentLayerId) external;

    function getTalentLayerIdWithLensID(bytes32 _lensId) external returns (uint256);

    event socialLink(bytes32 _lensId, uint256 _talentLayerId);
}
