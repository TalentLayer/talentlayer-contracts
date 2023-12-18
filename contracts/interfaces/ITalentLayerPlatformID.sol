// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../Arbitrator.sol";

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerPlatformID is IERC721Upgradeable {
    // Enum declarations
    enum MintStatus {
        ON_PAUSE,
        ONLY_WHITELIST,
        PUBLIC
    }

    // Struct declarations
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

    // Function declarations
    // View Functions
    function ids(address _user) external view returns (uint256);

    function isValid(uint256 _platformId) external view;

    function getOriginServiceFeeRate(uint256 _platformId) external view returns (uint16);

    function getOriginValidatedProposalFeeRate(uint256 _platformId) external view returns (uint16);

    function getServicePostingFee(uint256 _platformId) external view returns (uint256);

    function getProposalPostingFee(uint256 _platformId) external view returns (uint256);

    function getSigner(uint256 _platformId) external view returns (address);

    function getPlatform(uint256 _platformId) external view returns (Platform memory);

    function totalSupply() external view returns (uint256);

    // User Functions
    function mint(string calldata _platformName) external payable returns (uint256);

    function mintForAddress(string calldata _platformName, address _platformAddress) external payable returns (uint256);

    function updateProfileData(uint256 _platformId, string memory _newCid) external;

    function updateOriginServiceFeeRate(uint256 _platformId, uint16 _originServiceFeeRate) external;

    function updateOriginValidatedProposalFeeRate(uint256 _platformId, uint16 _originValidatedProposalFeeRate) external;

    function updateArbitrator(uint256 _platformId, Arbitrator _arbitrator, bytes memory _extraData) external;

    function updateArbitrationFeeTimeout(uint256 _platformId, uint256 _arbitrationFeeTimeout) external;

    function updateServicePostingFee(uint256 _platformId, uint256 _servicePostingFee) external;

    function updateProposalPostingFee(uint256 _platformId, uint256 _proposalPostingFee) external;

    function updateSigner(uint256 _platformId, address _signer) external;

    // Owner Functions
    function whitelistUser(address _user) external;

    function updateMintStatus(MintStatus _mintStatus) external;

    function updateMintFee(uint256 _mintFee) external;

    function withdraw() external;

    function addArbitrator(address _arbitrator, bool _isInternal) external;

    function removeArbitrator(address _arbitrator) external;

    function updateMinArbitrationFeeTimeout(uint256 _minArbitrationFeeTimeout) external;

    // Error declarations
    error HandleLengthInvalid();
    error HandleContainsInvalidCharacters();
    error HandleFirstCharInvalid();

    // Event declarations
    event Mint(
        address indexed platformOwnerAddress,
        uint256 platformId,
        string platformName,
        uint256 fee,
        uint256 arbitrationFeeTimeout
    );
    event CidUpdated(uint256 indexed platformId, string newCid);
    event MintFeeUpdated(uint256 mintFee);
    event OriginServiceFeeRateUpdated(uint256 platformId, uint16 originServiceFeeRate);
    event OriginValidatedProposalFeeRateUpdated(uint256 platformId, uint16 originValidatedProposalFeeRate);
    event ArbitratorAdded(address arbitrator, bool isInternal);
    event ArbitratorRemoved(address arbitrator);
    event ArbitratorUpdated(uint256 platformId, Arbitrator arbitrator, bytes extraData);
    event ArbitrationFeeTimeoutUpdated(uint256 platformId, uint256 arbitrationFeeTimeout);
    event MinArbitrationFeeTimeoutUpdated(uint256 minArbitrationFeeTimeout);
    event ServicePostingFeeUpdated(uint256 platformId, uint256 servicePostingFee);
    event ProposalPostingFeeUpdated(uint256 platformId, uint256 proposalPostingFee);
    event SignerUpdated(uint256 platformId, address signer);
    event MintStatusUpdated(MintStatus mintStatus);
    event UserWhitelisted(address indexed user);
}
