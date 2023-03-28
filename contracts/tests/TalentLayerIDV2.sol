// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerPlatformID} from "../interfaces/ITalentLayerPlatformID.sol";
import {ERC2771RecipientUpgradeable} from "../libs/ERC2771RecipientUpgradeable.sol";
import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

/**
 * @title TalentLayer ID Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
contract TalentLayerIDV2 is ERC2771RecipientUpgradeable, ERC721Upgradeable, UUPSUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using MerkleProofUpgradeable for bytes32[];

    /**
     * @notice min and max length for a handle
     */
    uint8 constant MIN_HANDLE_LENGTH = 1;
    uint8 constant MAX_HANDLE_LENGTH = 31;

    /**
     * @notice platform id for the protocol
     */
    uint8 constant PROTOCOL_ID = 0;

    /**
     * @notice Max number of characters for the handle where the dynamic priced is applied
     */
    uint8 constant MAX_PAID_HANDLE_CHARACTERS = 4;

    // =========================== Enums ==============================

    /**
     * @notice Enum for the mint status
     */
    enum MintStatus {
        ON_PAUSE,
        ONLY_WHITELIST,
        PUBLIC
    }

    // =========================== Structs ==============================

    /**
     * @notice TalentLayer Profile information struct
     * @param id the talentLayerId of the profile
     * @param handle the handle of the profile
     * @param platformId the TalentLayer Platform Id linked to the profile
     * @param dataUri the IPFS URI of the profile metadata
     */
    struct Profile {
        uint256 id;
        string handle;
        uint256 platformId;
        string dataUri;
    }

    // =========================== Mappings & Variables ==============================

    /**
     * @notice TalentLayer Platform ID registry
     */
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    /**
     * @notice Already taken handles
     */
    mapping(string => bool) public takenHandles;

    /**
     * @notice TalentLayer ID to Profile struct
     */
    mapping(uint256 => Profile) public profiles;

    /**
     * @notice Address to TalentLayer id
     */
    mapping(address => uint256) public ids;

    /**
     * @notice Price to mint an id with a regular handle length > MAX_PAID_HANDLE_CHARACTERS (in wei, upgradable)
     */
    uint256 public mintFee;

    /**
     * @notice Profile Id counter
     */
    CountersUpgradeable.Counter nextProfileId;

    /**
     * @notice TalentLayer ID to delegates
     */
    mapping(uint256 => mapping(address => bool)) private delegates;

    /**
     * @notice Merkle root of the whitelist for reserved handles
     */
    bytes32 private whitelistMerkleRoot;

    /**
     * @notice The minting status
     */
    MintStatus public mintStatus;

    /**
     * @notice Maximum price for a short handle (in wei, upgradable)
     */
    uint256 shortHandlesMaxPrice;

    /**
     * @notice Whether a TalentLayer ID has done some activity in the protocol (created a service or proposal)
     */
    mapping(uint256 => bool) public hasActivity;

    /**
     * @notice Whether a contract is a service contract, which is able to set if a user has done some activity
     */
    mapping(address => bool) public isServiceContract;

    uint256 testVariable;

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

    // =========================== View functions ==============================

    /**
     * @dev Returns the total number of tokens in existence.
     */
    function totalSupply() public view returns (uint256) {
        return nextProfileId.current() - 1;
    }

    /**
     * @notice Returns the platform ID of the platform which onboarded the user.
     * @param _address The address of the user
     */
    function getOriginatorPlatformIdByAddress(address _address) external view returns (uint256) {
        return profiles[ids[_address]].platformId;
    }

    /**
     * @notice Check whether a TalentLayer ID is valid.
     * @param _profileId The TalentLayer ID to check
     */
    function isValid(uint256 _profileId) external view {
        require(_profileId > 0 && _profileId < nextProfileId.current(), "not valid");
    }

    /**
     * @notice Check whether an address is a delegate for the given user.
     * @param _profileId The TalentLayer ID of the user
     * @param _address Address to check if it is a delegate
     */
    function isDelegate(uint256 _profileId, address _address) public view returns (bool) {
        return delegates[_profileId][_address];
    }

    /**
     * @notice Check whether an address is either the owner or a delegate for the given user.
     * @param _profileId The TalentLayer ID of the user
     * @param _address Address to check
     */
    function isOwnerOrDelegate(uint256 _profileId, address _address) public view returns (bool) {
        return ownerOf(_profileId) == _address || isDelegate(_profileId, _address);
    }

    /**
     * @notice get the owner of two different tokens
     * @param _tokenId1 The TalentLayer ID of the user 1
     * @param _tokenId2 The TalentLayer ID of the user 2
     */
    function ownersOf(uint256 _tokenId1, uint256 _tokenId2) external view returns (address, address) {
        return (ownerOf(_tokenId1), ownerOf(_tokenId2));
    }

    /**
     * @notice Check whether an address has reserved a handle.
     * @param _address Address to check
     * @param _handle Handle to check
     * @param _proof Merkle proof to prove the user has reserved the handle to be minted
     */
    function isWhitelisted(
        address _address,
        string memory _handle,
        bytes32[] memory _proof
    ) public view returns (bool) {
        string memory concatenatedString = string.concat(
            StringsUpgradeable.toHexString(uint256(uint160(_address)), 20),
            ";",
            _handle
        );
        return _proof.verify(whitelistMerkleRoot, keccak256(abi.encodePacked(concatenatedString)));
    }

    /**
     * @notice Returns the price to mint a TalentLayer ID with the given handle.
     * @param _handle Handle to check
     */
    function getHandlePrice(string calldata _handle) public view returns (uint256) {
        uint256 handleLength = bytes(_handle).length;
        return handleLength > MAX_PAID_HANDLE_CHARACTERS ? mintFee : shortHandlesMaxPrice / (2 ** (handleLength - 1));
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows a user to mint a new TalentLayerID.
     * @param _platformId Platform ID mint the id from
     * @param _handle Handle for the user
     */
    function mint(
        uint256 _platformId,
        string calldata _handle
    ) external payable canMint(_msgSender(), _handle, _platformId) canPay(_handle) returns (uint256) {
        require(mintStatus == MintStatus.PUBLIC, "Public mint is not enabled");
        address sender = _msgSender();
        _safeMint(sender, nextProfileId.current());
        return _afterMint(sender, _handle, _platformId, msg.value);
    }

    /**
     * @notice Allows a user to mint a new TalentLayerID for another address, paying the fee.
     * @param _address Address to mint the TalentLayer ID for
     * @param _platformId Platform ID mint the id from
     * @param _handle Handle for the user
     */
    function mintForAddress(
        address _address,
        uint256 _platformId,
        string calldata _handle
    ) external payable canMint(_address, _handle, _platformId) canPay(_handle) returns (uint256) {
        require(mintStatus == MintStatus.PUBLIC, "Public mint is not enabled");
        _safeMint(_address, nextProfileId.current());
        return _afterMint(_address, _handle, _platformId, msg.value);
    }

    /**
     * @notice Allows users who reserved a handle to mint a new TalentLayerID.
     * @param _platformId Platform ID mint the id from
     * @param _handle Handle for the user
     * @param _proof Merkle proof of the handle reservation whitelist
     */
    function whitelistMint(
        uint256 _platformId,
        string calldata _handle,
        bytes32[] calldata _proof
    ) external payable canMint(_msgSender(), _handle, _platformId) canPay(_handle) returns (uint256) {
        require(mintStatus == MintStatus.ONLY_WHITELIST, "Whitelist mint is not enabled");
        address sender = _msgSender();
        require(isWhitelisted(sender, _handle, _proof), "You're not whitelisted");

        _safeMint(sender, nextProfileId.current());
        return _afterMint(sender, _handle, _platformId, msg.value);
    }

    /**
     * @notice Update user data.
     * @dev we are trusting the user to provide the valid IPFS URI (changing in v2)
     * @param _profileId The TalentLayer ID of the user
     * @param _newCid New IPFS URI
     */
    function updateProfileData(uint256 _profileId, string memory _newCid) external onlyOwnerOrDelegate(_profileId) {
        require(bytes(_newCid).length == 46, "Invalid cid");
        profiles[_profileId].dataUri = _newCid;

        emit CidUpdated(_profileId, _newCid);
    }

    /**
     * @notice Allows to give rights to a delegate to perform actions for a user's profile
     * @param _profileId The TalentLayer ID of the user
     * @param _delegate Address of the delegate to add
     */
    function addDelegate(uint256 _profileId, address _delegate) external {
        require(ownerOf(_profileId) == _msgSender(), "Not the owner");
        delegates[_profileId][_delegate] = true;
        emit DelegateAdded(_profileId, _delegate);
    }

    /**
     * @notice Allows to remove rights from a delegate to perform actions for a user's profile
     * @param _profileId The TalentLayer ID of the user
     * @param _delegate Address of the delegate to remove
     */
    function removeDelegate(uint256 _profileId, address _delegate) external {
        require(ownerOf(_profileId) == _msgSender(), "Not the owner");
        delegates[_profileId][_delegate] = false;
        emit DelegateRemoved(_profileId, _delegate);
    }

    /**
     * @notice Allows to set whether a TalentLayer ID has done some activity (created a service or proposal)
     * @param _profileId The TalentLayer ID of the user
     */
    function setHasActivity(uint256 _profileId) external {
        require(isServiceContract[_msgSender()] == true, "Only service contracts can set whether a user has activity");
        hasActivity[_profileId] = true;
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Updates the mint fee.
     * @param _mintFee The new mint fee
     */
    function updateMintFee(uint256 _mintFee) external onlyOwner {
        mintFee = _mintFee;
        emit MintFeeUpdated(_mintFee);
    }

    /**
     * @notice Withdraws the contract balance to the owner.
     */
    function withdraw() external onlyOwner {
        (bool sent, ) = payable(_msgSender()).call{value: address(this).balance}("");
        require(sent, "Failed to withdraw Ether");
    }

    /**
     * @notice Allows the owner to mint a new TalentLayerID for a user for free.
     * @param _platformId Platform ID from which UserId was minted
     * @param _userAddress Address of the user
     * @param _handle Handle for the user
     */
    function freeMint(
        uint256 _platformId,
        address _userAddress,
        string calldata _handle
    ) external canMint(_userAddress, _handle, _platformId) onlyOwner returns (uint256) {
        _safeMint(_userAddress, nextProfileId.current());
        return _afterMint(_userAddress, _handle, _platformId, 0);
    }

    /**
     * @notice Allows the owner to set the merkle root for the whitelist for reserved handles
     * @param root The new merkle root
     */
    function setWhitelistMerkleRoot(bytes32 root) external onlyOwner {
        whitelistMerkleRoot = root;
    }

    /**
     * @notice Updates the mint status.
     * @param _mintStatus The new mint status
     */
    function updateMintStatus(MintStatus _mintStatus) external onlyOwner {
        mintStatus = _mintStatus;
        emit MintStatusUpdated(_mintStatus);
    }

    /**
     * @notice Updates the max price for short handles.
     * @param _shortHandlesMaxPrice The new max price for short handles
     */
    function updateShortHandlesMaxPrice(uint256 _shortHandlesMaxPrice) public onlyOwner {
        shortHandlesMaxPrice = _shortHandlesMaxPrice;
        emit ShortHandlesMaxPriceUpdated(_shortHandlesMaxPrice);
    }

    /**
     * @notice Updates the service contract address.
     * @param _address The address
     * @param _isServiceContract Whether the address is a service contract
     */
    function setIsServiceContract(address _address, bool _isServiceContract) external onlyOwner {
        isServiceContract[_address] = _isServiceContract;
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update handle address mapping and emit event after mint.
     * @dev Increments the nextProfileId counter.
     * @param _userAddress address of the user that will receive the NFT
     * @param _handle Handle for the user
     * @param _platformId Platform ID from which UserId was minted
     * @param _fee fee paid for minting
     */
    function _afterMint(
        address _userAddress,
        string memory _handle,
        uint256 _platformId,
        uint256 _fee
    ) private returns (uint256) {
        uint256 userProfileId = nextProfileId.current();
        nextProfileId.increment();
        Profile storage profile = profiles[userProfileId];
        profile.platformId = _platformId;
        profile.handle = _handle;
        takenHandles[_handle] = true;
        ids[_userAddress] = userProfileId;

        emit Mint(_userAddress, userProfileId, _handle, _platformId, _fee);
        return userProfileId;
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

    // =========================== Internal functions ==============================

    /**
     * @notice Function that revert when `_msgSender()` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override(UUPSUpgradeable) onlyOwner {}

    // =========================== Overrides ==============================

    /**
     * @notice Transfer the token from one address to another only if the NFT has no actiity linked to it.
     * @param from address of the sender
     * @param to address of the receiver
     * @param tokenId id of the token to transfer
     */
    function _transfer(address from, address to, uint256 tokenId) internal virtual override(ERC721Upgradeable) {
        require(!hasActivity[tokenId], "Token transfer is not allowed");
        require(balanceOf(to) == 0, "Receiver already has a TalentLayer ID");
        ids[from] = 0;
        ids[to] = tokenId;
        ERC721Upgradeable._transfer(from, to, tokenId);
    }

    /**
     * @dev Blocks the burn function
     * @param tokenId The ID of the token
     */
    function _burn(uint256 tokenId) internal virtual override(ERC721Upgradeable) {}

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
        string memory username = string.concat(profiles[id].handle, ".tl");
        string memory fontSizeStr = bytes(profiles[id].handle).length <= 20 ? "60" : "40";

        bytes memory image = abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64Upgradeable.encode(
                bytes(
                    abi.encodePacked(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="100%" height="100%"/><svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" version="1.2" viewBox="-200 -50 1000 1000"><path fill="#FFFFFF" d="M264.5 190.5c0-13.8 11.2-25 25-25H568c13.8 0 25 11.2 25 25v490c0 13.8-11.2 25-25 25H289.5c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M265 624c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25v56.5c0 13.8-11.2 25-25 25H290c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M0 190.5c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25V247c0 13.8-11.2 25-25 25H25c-13.8 0-25-11.2-25-25z"/></svg><text x="30" y="670" style="font: ',
                        fontSizeStr,
                        'px sans-serif;fill:#fff">',
                        username,
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
                                username,
                                '", "image":"',
                                image,
                                unicode'", "description": "TalentLayer ID"}'
                            )
                        )
                    )
                )
            );
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (address)
    {
        return ERC2771RecipientUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771RecipientUpgradeable._msgData();
    }

    // =========================== Modifiers ==============================

    /**
     * @notice Check if _msgSender() can pay the mint fee for a TalentLayer id with the given handle
     * @param _handle Handle for the user
     */
    modifier canPay(string calldata _handle) {
        require(msg.value == getHandlePrice(_handle), "Incorrect amount of ETH for mint fee");
        _;
    }

    /**
     * Check if it is possible to mint a new TalentLayerID for a given address.
     * @param _userAddress Address to mint TalentLayer for.
     * @param _handle Handle for the user
     * @param _platformId Platform that wants to mint the TalentLayerID
     */
    modifier canMint(
        address _userAddress,
        string calldata _handle,
        uint256 _platformId
    ) {
        require(balanceOf(_userAddress) == 0, "You already have a TalentLayerID");
        require(!takenHandles[_handle], "Handle already taken");
        if (_platformId != PROTOCOL_ID) {
            talentLayerPlatformIdContract.isValid(_platformId);
        }
        _validateHandle(_handle);
        _;
    }

    /**
     * @notice Check if the given address is either the owner of the delegate of the given user
     * @param _profileId The TalentLayer ID of the user
     */
    modifier onlyOwnerOrDelegate(uint256 _profileId) {
        require(isOwnerOrDelegate(_profileId, _msgSender()), "Not owner or delegate");
        _;
    }

    // =========================== Events ==============================

    /**
     * Emit when new TalentLayerID is minted.
     * @param user Address of the owner of the TalentLayerID
     * @param profileId The TalentLayer ID of the user
     * @param handle Handle for the user
     * @param platformId Platform ID from which UserId was minted
     * @param fee Fee paid to mint the TalentLayerID
     */
    event Mint(address indexed user, uint256 profileId, string handle, uint256 platformId, uint256 fee);

    /**
     * Emit when Cid is updated for a user.
     * @param profileId The TalentLayer ID of the user
     * @param newCid Content ID
     */
    event CidUpdated(uint256 indexed profileId, string newCid);

    /**
     * Emit when mint fee is updated
     * @param mintFee The new mint fee
     */
    event MintFeeUpdated(uint256 mintFee);

    /**
     * Emit when a delegate is added for a user.
     * @param profileId The TalentLayer ID of the user
     * @param delegate Address of the delegate
     */
    event DelegateAdded(uint256 profileId, address delegate);

    /**
     * Emit when a delegate is removed for a user.
     * @param profileId The TalentLayer ID of the user
     * @param delegate Address of the delegate
     */
    event DelegateRemoved(uint256 profileId, address delegate);

    /**
     * Emit when the minting status is updated
     * @param mintStatus The new mint status
     */
    event MintStatusUpdated(MintStatus mintStatus);

    /**
     * Emit when the max price for short handles is udpated
     * @param price The new max price for short handles
     */
    event ShortHandlesMaxPriceUpdated(uint256 price);
}
