// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../Arbitrator.sol";

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerPlatformID is IERC721Upgradeable {
    struct Platform {
        uint256 id;
        string name;
        string dataUri;
        uint16 originServiceFeeRate;
        uint16 originValidatedProposalFeeRate;
        uint256 servicePostingFee;
        uint256 proposalPostingFee;
        Arbitrator arbitrator;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
        address signer;
    }

    function balanceOf(address _platformAddress) external view returns (uint256);

    function getOriginServiceFeeRate(uint256 _platformId) external view returns (uint16);

    function getOriginValidatedProposalFeeRate(uint256 _platformId) external view returns (uint16);

    function getSigner(uint256 _platformId) external view returns (address);

    function getPlatform(uint256 _platformId) external view returns (Platform memory);

    function mint(string memory _platformName) external returns (uint256);

    function mintForAddress(string memory _platformName, address _platformAddress) external payable returns (uint256);

    function totalSupply() external view returns (uint256);

    function updateProfileData(uint256 _platformId, string memory _newCid) external;

    function updateOriginServiceFeeRate(uint256 _platformId, uint16 _originServiceFeeRate) external;

    function updateOriginValidatedProposalFeeRate(uint256 _platformId, uint16 _originValidatedProposalFeeRate) external;

    function updateArbitrator(uint256 _platformId, Arbitrator _arbitrator, bytes memory _extraData) external;

    function updateArbitrationFeeTimeout(uint256 _platformId, uint256 _arbitrationFeeTimeout) external;

    function updateRecoveryRoot(bytes32 _newRoot) external;

    function updateMintFee(uint256 _mintFee) external;

    function withdraw() external;

    function addArbitrator(address _arbitrator, bool _isInternal) external;

    function removeArbitrator(address _arbitrator) external;

    function isValid(uint256 _platformId) external view;

    function updateMinArbitrationFeeTimeout(uint256 _minArbitrationFeeTimeout) external;

    function getServicePostingFee(uint256 _platformId) external view returns (uint256);

    function getProposalPostingFee(uint256 _platformId) external view returns (uint256);

    function updateServicePostingFee(uint256 _platformId, uint256 _servicePostingFee) external;

    function updateProposalPostingFee(uint256 _platformId, uint256 _proposalPostingFee) external;

    function ids(address _user) external view returns (uint256);

    event Mint(address indexed _platformOwnerAddress, uint256 _tokenId, string _platformName);

    event CidUpdated(uint256 indexed _tokenId, string _newCid);
}
