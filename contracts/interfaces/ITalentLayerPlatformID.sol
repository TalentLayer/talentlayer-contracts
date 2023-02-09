// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../Arbitrator.sol";

/**
 * @title Platform ID Interface
 * @author TalentLayer Team
 */
interface ITalentLayerPlatformID is IERC721Upgradeable {
    struct Platform {
        uint256 id;
        string name;
        string dataUri;
        uint16 fee;
        Arbitrator arbitrator;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
    }

    function numberMinted(address _platformAddress) external view returns (uint256);

    function getPlatformEscrowFeeRate(uint256 _platformId) external view returns (uint16);

    function getPlatform(uint256 _platformId) external view returns (Platform memory);

    function getPlatformIdFromAddress(address _owner) external view returns (uint256);

    function mint(string memory _platformName) external;

    function updateProfileData(uint256 _platformId, string memory _newCid) external;

    function isValid(uint256 _platformId) external view;

    event Mint(address indexed _platformOwnerAddress, uint256 _tokenId, string _platformName);

    event CidUpdated(uint256 indexed _tokenId, string _newCid);
}
