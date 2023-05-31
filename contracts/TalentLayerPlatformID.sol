// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Arbitrator} from "./Arbitrator.sol";

/**
 * @title Platform ID Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
contract TalentLayerPlatformID is ERC721Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    uint8 constant MIN_HANDLE_LENGTH = 5;
    uint8 constant MAX_HANDLE_LENGTH = 31;

    // =========================== Enum ==============================

    /**
     * @notice Enum for the mint status
     */
    enum MintStatus {
        ON_PAUSE,
        ONLY_WHITELIST,
        PUBLIC
    }

    // =========================== Variables ==============================

    /**
     * @notice TalentLayer Platform information struct
     * @param id the TalentLayer Platform Id
     * @param name the name of the platform
     * @param dataUri the IPFS URI of the Platform metadata
     * @param originServiceFeeRate the %fee (per ten thousands) asked by the platform for each service created on the platform
     * @param originValidatedProposalFeeRate the %fee (per ten thousands) asked by the platform for each validates service on the platform
     * @param servicePostingFee the fee (flat) asked by the platform to post a service on the platform
     * @param proposalPostingFee the fee (flat) asked by the platform to post a proposal on the platform
     * @param arbitrator address of the arbitrator used by the platform
     * @param arbitratorExtraData extra information for the arbitrator
     * @param arbitrationFeeTimeout timeout for parties to pay the arbitration fee
     * @param signer address used to sign operations which need platform authorization
     */
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

    /**
     * @notice Taken Platform name
     */
    mapping(string => bool) public takenNames;

    /**
     * @notice Platform ID to Platform struct
     */
    mapping(uint256 => Platform) public platforms;

    /**
     * @notice Addresses which are available as arbitrators
     */
    mapping(address => bool) public validArbitrators;

    /**
     * @notice Addresses which are allowed to mint a Platform ID
     */
    mapping(address => bool) public whitelist;

    /**
     * @notice Whether arbitrators are internal (are part of TalentLayer) or not
     *         Internal arbitrators will have the extra data set to the platform ID
     */
    mapping(address => bool) public internalArbitrators;

    /**
     * @notice Address to PlatformId
     */
    mapping(address => uint256) public ids;

    /**
     * @notice Price to mint a platform id (in wei, upgradable)
     */
    uint256 public mintFee;

    /**
     * @notice Role granting Minting permission
     */
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

    /**
     * @notice Minimum timeout to pay arbitration fee
     */
    uint256 public minArbitrationFeeTimeout;

    /**
     * @notice Platform Id counter
     */
    CountersUpgradeable.Counter private nextPlatformId;

    /**
     * @notice  The minting status
     */
    MintStatus public mintStatus;

    // =========================== Errors ==============================

    /**
     * @notice error thrown when input handle is 0 or more than 31 characters long.
     */
    error HandleLengthInvalid();

    /**
     * @notice error thrown when input handle contains restricted characters.
     */
    error HandleContainsInvalidCharacters();

    /**
     * @notice error thrown when input handle has an invalid first character.
     */
    error HandleFirstCharInvalid();

    // =========================== Initializers ==============================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("TalentLayerPlatformID", "TLPID");
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINT_ROLE, msg.sender);
        mintFee = 0;
        validArbitrators[address(0)] = true; // The zero address means no arbitrator.
        updateMinArbitrationFeeTimeout(10 days);
        // Increment counter to start platform ids at index 1
        nextPlatformId.increment();
        mintStatus = MintStatus.ONLY_WHITELIST;
    }

    // =========================== View functions ==============================

    /**
     * @notice Check whether the TalentLayer Platform Id is valid.
     * @param _platformId The Platform Id.
     */
    function isValid(uint256 _platformId) public view {
        require(_platformId > 0 && _platformId < nextPlatformId.current(), "Invalid platform ID");
    }

    /**
     * @notice Allows retrieval of a Platform fee
     * @param _platformId The Platform Id
     * @return The Platform fee
     */
    function getOriginServiceFeeRate(uint256 _platformId) external view returns (uint16) {
        isValid(_platformId);
        return platforms[_platformId].originServiceFeeRate;
    }

    /**
     * @notice Allows retrieval of a Platform fee
     * @param _platformId The Platform Id
     * @return The Platform fee
     */
    function getOriginValidatedProposalFeeRate(uint256 _platformId) external view returns (uint16) {
        isValid(_platformId);
        return platforms[_platformId].originValidatedProposalFeeRate;
    }

    /**
     * @notice Allows retrieval of a service posting fee
     * @param _platformId The Platform Id
     * @return The Service posting fee
     */
    function getServicePostingFee(uint256 _platformId) external view returns (uint256) {
        isValid(_platformId);
        return platforms[_platformId].servicePostingFee;
    }

    /**
     * @notice Allows retrieval of a proposal posting fee
     * @param _platformId The Platform Id
     * @return The Proposal posting fee
     */
    function getProposalPostingFee(uint256 _platformId) external view returns (uint256) {
        isValid(_platformId);
        return platforms[_platformId].proposalPostingFee;
    }

    /**
     * @notice Allows retrieval of the signer of a platform
     * @param _platformId The Platform Id
     * @return The signer of the platform
     */
    function getSigner(uint256 _platformId) external view returns (address) {
        isValid(_platformId);
        return platforms[_platformId].signer;
    }

    /**
     * @notice Allows retrieval of a Platform arbitrator
     * @param _platformId The Platform Id
     * @return Arbitrator The Platform arbitrator
     */
    function getPlatform(uint256 _platformId) external view returns (Platform memory) {
        isValid(_platformId);
        return platforms[_platformId];
    }

    /**
     * @dev Returns the total number of tokens in existence.
     */
    function totalSupply() public view returns (uint256) {
        return nextPlatformId.current() - 1;
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows a platform to mint a new Platform Id.
     * @param _platformName Platform name
     */
    function mint(string calldata _platformName) public payable canMint(_platformName, msg.sender) returns (uint256) {
        _mint(msg.sender, nextPlatformId.current());
        return _afterMint(_platformName, msg.sender);
    }

    /**
     * @notice Allows a user to mint a new Platform Id and assign it to an eth address.
     * @dev You need to have MINT_ROLE to use this function
     * @param _platformName Platform name
     * @param _platformAddress Eth Address to assign the Platform Id to
     */
    function mintForAddress(
        string calldata _platformName,
        address _platformAddress
    ) public payable canMint(_platformName, _platformAddress) onlyRole(MINT_ROLE) returns (uint256) {
        _mint(_platformAddress, nextPlatformId.current());
        return _afterMint(_platformName, _platformAddress);
    }

    /**
     * @notice Update platform URI data.
     * @dev we are trusting the platform to provide the valid IPFS URI
     * @param _platformId The Platform Id
     * @param _newCid New IPFS URI
     */
    function updateProfileData(uint256 _platformId, string memory _newCid) public onlyPlatformOwner(_platformId) {
        require(bytes(_newCid).length == 46, "Invalid cid");

        platforms[_platformId].dataUri = _newCid;

        emit CidUpdated(_platformId, _newCid);
    }

    /**
     * @notice Allows a platform to update his fee
     * @param _platformId The Platform Id
     * @param _originServiceFeeRate Platform fee to update
     */
    function updateOriginServiceFeeRate(
        uint256 _platformId,
        uint16 _originServiceFeeRate
    ) public onlyPlatformOwner(_platformId) {
        platforms[_platformId].originServiceFeeRate = _originServiceFeeRate;
        emit OriginServiceFeeRateUpdated(_platformId, _originServiceFeeRate);
    }

    /**
     * @notice Allows a platform to update his fee
     * @param _platformId The Platform Id
     * @param _originValidatedProposalFeeRate Platform fee to update
     */
    function updateOriginValidatedProposalFeeRate(
        uint256 _platformId,
        uint16 _originValidatedProposalFeeRate
    ) public onlyPlatformOwner(_platformId) {
        platforms[_platformId].originValidatedProposalFeeRate = _originValidatedProposalFeeRate;
        emit OriginValidatedProposalFeeRateUpdated(_platformId, _originValidatedProposalFeeRate);
    }

    /**
     * @notice Allows a platform to update his arbitrator
     * @param _platformId The Platform Id
     * @param _arbitrator the arbitrator
     * @param _extraData the extra data for arbitrator (this is only used for external arbitrators, for internal arbitrators it should be empty)
     */
    function updateArbitrator(
        uint256 _platformId,
        Arbitrator _arbitrator,
        bytes memory _extraData
    ) public onlyPlatformOwner(_platformId) {
        require(validArbitrators[address(_arbitrator)], "The address must be of a valid arbitrator");

        platforms[_platformId].arbitrator = _arbitrator;

        if (internalArbitrators[address(_arbitrator)]) {
            platforms[_platformId].arbitratorExtraData = abi.encodePacked(_platformId);
        } else {
            platforms[_platformId].arbitratorExtraData = _extraData;
        }

        emit ArbitratorUpdated(_platformId, _arbitrator, platforms[_platformId].arbitratorExtraData);
    }

    /**
     * @notice Allows a platform to update the timeout for paying the arbitration fee
     * @param _platformId The Platform Id
     * @param _arbitrationFeeTimeout The new timeout
     */
    function updateArbitrationFeeTimeout(
        uint256 _platformId,
        uint256 _arbitrationFeeTimeout
    ) public onlyPlatformOwner(_platformId) {
        require(
            _arbitrationFeeTimeout >= minArbitrationFeeTimeout,
            "The timeout must be greater than the minimum timeout"
        );

        platforms[_platformId].arbitrationFeeTimeout = _arbitrationFeeTimeout;
        emit ArbitrationFeeTimeoutUpdated(_platformId, _arbitrationFeeTimeout);
    }

    /**
     * @notice Allows a platform to update the service posting fee for the platform
     * @param _platformId The platform Id of the platform
     * @param _servicePostingFee The new fee
     */
    function updateServicePostingFee(
        uint256 _platformId,
        uint256 _servicePostingFee
    ) public onlyPlatformOwner(_platformId) {
        platforms[_platformId].servicePostingFee = _servicePostingFee;
        emit ServicePostingFeeUpdated(_platformId, _servicePostingFee);
    }

    /**
     * @notice Allows a platform to update the proposal posting fee for the platform
     * @param _platformId The platform Id of the platform
     * @param _proposalPostingFee The new fee
     */
    function updateProposalPostingFee(
        uint256 _platformId,
        uint256 _proposalPostingFee
    ) public onlyPlatformOwner(_platformId) {
        platforms[_platformId].proposalPostingFee = _proposalPostingFee;
        emit ProposalPostingFeeUpdated(_platformId, _proposalPostingFee);
    }

    /**
     * @notice Allows a platform to update its signer address
     * @param _platformId The platform Id of the platform
     * @param _signer The new signer address
     */
    function updateSigner(uint256 _platformId, address _signer) public onlyPlatformOwner(_platformId) {
        platforms[_platformId].signer = _signer;
        emit SignerUpdated(_platformId, _signer);
    }

    // =========================== Owner functions ==============================

    /**
     * @notice whitelist a user.
     * @param _user Address of the user to whitelist
     */
    function whitelistUser(address _user) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelist[_user] = true;
        emit UserWhitelisted(_user);
    }

    /**
     * @notice Updates the mint status.
     * @param _mintStatus The new mint status
     */
    function updateMintStatus(MintStatus _mintStatus) public onlyRole(DEFAULT_ADMIN_ROLE) {
        mintStatus = _mintStatus;
        emit MintStatusUpdated(_mintStatus);
    }

    /**
     * Updates the mint fee.
     * @param _mintFee The new mint fee
     */
    function updateMintFee(uint256 _mintFee) public onlyRole(DEFAULT_ADMIN_ROLE) {
        mintFee = _mintFee;
        emit MintFeeUpdated(_mintFee);
    }

    /**
     * Withdraws the contract balance to the admin.
     */
    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool sent, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(sent, "Failed to withdraw Ether");
    }

    /**
     * @notice Adds a new available arbitrator.
     * @param _arbitrator address of the arbitrator
     * @param _isInternal whether the arbitrator is internal (is part of TalentLayer) or not
     * @dev You need to have DEFAULT_ADMIN_ROLE to use this function
     */
    function addArbitrator(address _arbitrator, bool _isInternal) public onlyRole(DEFAULT_ADMIN_ROLE) {
        validArbitrators[address(_arbitrator)] = true;
        internalArbitrators[address(_arbitrator)] = _isInternal;
    }

    /**
     * @notice Removes an available arbitrator.
     * @param _arbitrator address of the arbitrator
     * @dev You need to have DEFAULT_ADMIN_ROLE to use this function
     */
    function removeArbitrator(address _arbitrator) public onlyRole(DEFAULT_ADMIN_ROLE) {
        validArbitrators[address(_arbitrator)] = false;
        internalArbitrators[address(_arbitrator)] = false;
    }

    /**
     * @notice Updates the minimum timeout for paying the arbitration fee.
     * @param _minArbitrationFeeTimeout The new minimum timeout
     * @dev You need to have DEFAULT_ADMIN_ROLE to use this function
     */
    function updateMinArbitrationFeeTimeout(uint256 _minArbitrationFeeTimeout) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minArbitrationFeeTimeout = _minArbitrationFeeTimeout;
        emit MinArbitrationFeeTimeoutUpdated(_minArbitrationFeeTimeout);
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update Platform name mapping and emit event after mint.
     * @param _platformName Name of the platform.
     * @param _platformAddress Address of the platform.
     * @dev Increments the nextTokenId counter.
     */
    function _afterMint(string memory _platformName, address _platformAddress) private returns (uint256) {
        uint256 platformId = nextPlatformId.current();
        nextPlatformId.increment();
        Platform storage platform = platforms[platformId];
        platform.name = _platformName;
        platform.id = platformId;
        platform.arbitrationFeeTimeout = minArbitrationFeeTimeout;
        platform.signer = address(0);
        takenNames[_platformName] = true;
        ids[_platformAddress] = platformId;

        emit Mint(_platformAddress, platformId, _platformName, mintFee, minArbitrationFeeTimeout);

        return platformId;
    }

    /**
     * @notice Validate characters used in the handle, only alphanumeric, only lowercase characters, - and _ are allowed but as first one
     * @param handle Handle to validate
     */
    function _validateHandle(string calldata handle) private pure {
        bytes memory byteHandle = bytes(handle);
        uint256 byteHandleLength = byteHandle.length;
        if (byteHandleLength < MIN_HANDLE_LENGTH || byteHandleLength > MAX_HANDLE_LENGTH) revert HandleLengthInvalid();

        bytes1 firstByte = bytes(handle)[0];
        if (firstByte == "-" || firstByte == "_") revert HandleFirstCharInvalid();

        for (uint256 i = 0; i < byteHandleLength; ) {
            if (
                (byteHandle[i] < "0" || byteHandle[i] > "z" || (byteHandle[i] > "9" && byteHandle[i] < "a")) &&
                byteHandle[i] != "-" &&
                byteHandle[i] != "_"
            ) revert HandleContainsInvalidCharacters();
            ++i;
        }
    }

    // =========================== Overrides ==============================

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721Upgradeable, AccessControlUpgradeable) returns (bool) {
        return
            ERC721Upgradeable.supportsInterface(interfaceId) || AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    /**
     * @dev Override to prevent token transfer.
     */
    function _transfer(address, address, uint256) internal virtual override(ERC721Upgradeable) {
        revert("Token transfer is not allowed");
    }

    /**
     * @notice Implementation of the {IERC721Metadata-tokenURI} function.
     * @param tokenId The ID of the token
     */
    function tokenURI(uint256 tokenId) public view virtual override(ERC721Upgradeable) returns (string memory) {
        return _buildTokenURI(tokenId);
    }

    /**
     * @notice Builds the token URI
     * @param id The ID of the token
     */
    function _buildTokenURI(uint256 id) internal view returns (string memory) {
        string memory platformName = string.concat(platforms[id].name, ".tlp");
        string memory fontSizeStr = bytes(platforms[id].name).length <= 20 ? "60" : "40";

        bytes memory image = abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64Upgradeable.encode(
                bytes(
                    abi.encodePacked(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="100%" height="100%"/><svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" version="1.2" viewBox="-200 -50 1000 1000"><path fill="#FFFFFF" d="M264.5 190.5c0-13.8 11.2-25 25-25H568c13.8 0 25 11.2 25 25v490c0 13.8-11.2 25-25 25H289.5c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M265 624c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25v56.5c0 13.8-11.2 25-25 25H290c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M0 190.5c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25V247c0 13.8-11.2 25-25 25H25c-13.8 0-25-11.2-25-25z"/></svg><text x="30" y="670" style="font: ',
                        fontSizeStr,
                        'px sans-serif;fill:#fff">',
                        platformName,
                        "</text></svg>"
                    )
                )
            )
        );
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64Upgradeable.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                platformName,
                                '", "image":"',
                                image,
                                unicode'", "description": "TalentLayer Platform ID"}'
                            )
                        )
                    )
                )
            );
    }

    /**
     * @notice Function that revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override(UUPSUpgradeable) onlyRole(DEFAULT_ADMIN_ROLE) {}

    // =========================== Modifiers ==============================

    /**
     * @notice Check if Platform is able to mint a new Platform ID.
     * @param _platformName name for the platform
     * @param _platformAddress address of the platform associated with the ID
     */
    modifier canMint(string calldata _platformName, address _platformAddress) {
        require(mintStatus == MintStatus.ONLY_WHITELIST || mintStatus == MintStatus.PUBLIC, "Mint status is not valid");
        if (mintStatus == MintStatus.ONLY_WHITELIST) {
            require(whitelist[msg.sender], "You are not whitelisted");
        }
        require(msg.value == mintFee, "Incorrect amount of ETH for mint fee");
        require(balanceOf(_platformAddress) == 0, "Platform already has a Platform ID");
        require(!takenNames[_platformName], "Name already taken");

        _validateHandle(_platformName);
        _;
    }

    /**
     * @notice Check if msg sender is the owner of a platform
     * @param _platformId the ID of the platform
     */
    modifier onlyPlatformOwner(uint256 _platformId) {
        require(ownerOf(_platformId) == msg.sender, "Not the owner");
        _;
    }

    // =========================== Events ==============================

    /**
     * @notice Emit when new Platform ID is minted.
     * @param platformOwnerAddress Address of the owner of the PlatformID
     * @param platformId The Platform ID
     * @param platformName Name of the platform
     * @param fee Fee paid to mint the Platform ID
     * @param arbitrationFeeTimeout Timeout to pay arbitration fee
     */
    event Mint(
        address indexed platformOwnerAddress,
        uint256 platformId,
        string platformName,
        uint256 fee,
        uint256 arbitrationFeeTimeout
    );

    /**
     * @notice Emit when Cid is updated for a platform.
     * @param platformId The Platform ID
     * @param newCid New URI
     */
    event CidUpdated(uint256 indexed platformId, string newCid);

    /**
     * @notice Emit when mint fee is updated
     * @param mintFee The new mint fee
     */
    event MintFeeUpdated(uint256 mintFee);

    /**
     * @notice Emit when the fee is updated for a platform
     * @param platformId The Platform Id
     * @param originServiceFeeRate The new fee
     */
    event OriginServiceFeeRateUpdated(uint256 platformId, uint16 originServiceFeeRate);

    /**
     * @notice Emit when the fee is updated for a platform
     * @param platformId The Platform Id
     * @param originValidatedProposalFeeRate The new fee
     */
    event OriginValidatedProposalFeeRateUpdated(uint256 platformId, uint16 originValidatedProposalFeeRate);

    /**
     * @notice Emit after the arbitrator is updated for a platform
     * @param platformId The Platform Id
     * @param arbitrator The address of the new arbitrator
     * @param extraData The new extra data for the arbitrator
     */
    event ArbitratorUpdated(uint256 platformId, Arbitrator arbitrator, bytes extraData);

    /**
     * @notice Emit after the arbitration fee timeout is updated for a platform
     * @param platformId The Platform Id
     * @param arbitrationFeeTimeout The new arbitration fee timeout
     */
    event ArbitrationFeeTimeoutUpdated(uint256 platformId, uint256 arbitrationFeeTimeout);

    /**
     * @notice Emit after the minimum arbitration fee timeout is updated
     * @param minArbitrationFeeTimeout The new arbitration fee timeout
     */
    event MinArbitrationFeeTimeoutUpdated(uint256 minArbitrationFeeTimeout);

    /**
     * @notice Emit when the service posting fee is updated for a platform
     * @param platformId The Platform Id
     * @param servicePostingFee The new fee
     */
    event ServicePostingFeeUpdated(uint256 platformId, uint256 servicePostingFee);

    /**
     * @notice Emit when the proposal posting fee is updated for a platform
     * @param platformId The Platform Id
     * @param proposalPostingFee The new fee
     */
    event ProposalPostingFeeUpdated(uint256 platformId, uint256 proposalPostingFee);

    /**
     * @notice Emit when the signer address is updated for a platform
     * @param platformId The Platform Id
     * @param signer The new signer address
     */
    event SignerUpdated(uint256 platformId, address signer);

    /**
     * @notice Emit when the minting status is updated
     * @param mintStatus The new mint status
     */
    event MintStatusUpdated(MintStatus mintStatus);

    /**
     * @notice Emit when a platform is whitelisted
     * @param user The new address whitelited
     */
    event UserWhitelisted(address indexed user);
}
