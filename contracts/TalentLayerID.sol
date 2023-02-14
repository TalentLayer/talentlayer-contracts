// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";
import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";

import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title TalentLayer ID Contract
 * @author TalentLayer Team
 */
contract TalentLayerID is ERC2771RecipientUpgradeable, ERC721Upgradeable, UUPSUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // =========================== Structs ==============================

    /// @notice TalentLayer Profile information struct
    /// @param profileId the talentLayerId of the profile
    /// @param handle the handle of the profile
    /// @param platformId the TalentLayer Platform Id linked to the profile
    /// @param dataUri the IPFS URI of the profile metadata
    struct Profile {
        uint256 id;
        string handle;
        uint256 platformId;
        string dataUri;
    }

    // =========================== Mappings & Variables ==============================

    /// TalentLayer Platform ID registry
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    /// Taken handles
    mapping(string => bool) public takenHandles;

    /// Token ID to Profile struct
    mapping(uint256 => Profile) public profiles;

    /// Address to TalentLayer id
    mapping(address => uint256) private _ids;

    /// Price to mint an id (in wei, upgradable)
    uint256 public mintFee;

    /// TokenId counter
    CountersUpgradeable.Counter nextTokenId;

    /// TokenId to delegates
    mapping(uint256 => mapping(address => bool)) private delegates;

    // =========================== Initializers ==============================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice First initializer function
     * @param _talentLayerPlatformIdAddress TalentLayerPlatformId contract address
     */
    function initialize(address _talentLayerPlatformIdAddress) public initializer {
        __Ownable_init();
        __ERC721_init("TalentLayerID", "TID");
        __UUPSUpgradeable_init();
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
        // Increment counter to start tokenIds at index 1
        nextTokenId.increment();
    }

    // =========================== View functions ==============================

    /**
     * @notice Allows retrieval of number of minted TalentLayerIDs for a user.
     * @param _user Address of the owner of the TalentLayerID
     * @return the number of tokens minted by the user
     */
    function numberMinted(address _user) public view returns (uint256) {
        return balanceOf(_user);
    }

    /**
     * @dev Returns the total number of tokens in existence.
     */
    function totalSupply() public view returns (uint256) {
        return nextTokenId.current() - 1;
    }

    /**
     * @notice Returns the Profile struct of a given token ID
     * @param _profileId the token ID of the profile
     * @return The Profile struct of the token ID
     */
    function getProfile(uint256 _profileId) external view returns (Profile memory) {
        require(_exists(_profileId), "TalentLayerID: Profile does not exist");
        return profiles[_profileId];
    }

    /**
     * @notice Allows getting the TalentLayerID of one address
     * @param _owner Address to check
     * @return uint256 the id of the NFT
     */
    function walletOfOwner(address _owner) public view returns (uint256) {
        return _ids[_owner];
    }

    /**
     * @notice Returns the platform ID of the platform which onboarded the user.
     * @param _address The address of the user
     */
    function getOriginatorPlatformIdByAddress(address _address) external view returns (uint256) {
        return profiles[walletOfOwner(_address)].platformId;
    }

    /**
     * @notice Check whether the User Token Id is valid.
     * @param _tokenId Token ID to check
     */
    function isValid(uint256 _tokenId) external view {
        require(_tokenId > 0 && _tokenId < nextTokenId.current(), "Your ID is not a valid token ID");
    }

    /**
     * @notice Check whether an address is a delegate for the given user.
     * @param _tokenId Token ID to check
     * @param _address Address to check if it is a delegate
     */
    function isDelegate(uint256 _tokenId, address _address) public view returns (bool) {
        return delegates[_tokenId][_address];
    }

    /**
     * @notice Check whether an address is either the owner or a delegate for the token ID.
     * @param _tokenId Token ID to check
     * @param _address Address to check
     */
    function isOwnerOrDelegate(uint256 _tokenId, address _address) public view returns (bool) {
        return ownerOf(_tokenId) == _address || isDelegate(_tokenId, _address);
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows a user to mint a new TalentLayerID without.
     * @param _handle Handle for the user
     * @param _platformId Platform ID mint the id from
     */
    function mint(
        uint256 _platformId,
        string memory _handle
    ) public payable canPay canMint(_msgSender(), _handle, _platformId) {
        address sender = _msgSender();
        _safeMint(sender, nextTokenId.current());
        _afterMint(sender, _handle, _platformId, msg.value);
    }

    /**
     * @notice Update user data.
     * @dev we are trusting the user to provide the valid IPFS URI (changing in v2)
     * @param _tokenId Token ID to update
     * @param _newCid New IPFS URI
     */
    function updateProfileData(uint256 _tokenId, string memory _newCid) public onlyOwnerOrDelegate(_tokenId) {
        require(bytes(_newCid).length > 0, "Should provide a valid IPFS URI");
        profiles[_tokenId].dataUri = _newCid;

        emit CidUpdated(_tokenId, _newCid);
    }

    /**
     * @notice Allows to give rights to a delegate to perform actions for a user's profile
     * @param _delegate Address of the delegate to add
     */
    function addDelegate(uint256 _tokenId, address _delegate) external {
        require(ownerOf(_tokenId) == _msgSender(), "Only owner can add delegates");
        delegates[_tokenId][_delegate] = true;
        emit DelegateAdded(_tokenId, _delegate);
    }

    /**
     * @notice Allows to remove rights from a delegate to perform actions for a user's profile
     * @param _delegate Address of the delegate to remove
     */
    function removeDelegate(uint256 _tokenId, address _delegate) external {
        require(ownerOf(_tokenId) == _msgSender(), "Only owner can remove delegates");
        delegates[_tokenId][_delegate] = false;
        emit DelegateRemoved(_tokenId, _delegate);
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Updates the mint fee.
     * @param _mintFee The new mint fee
     */
    function updateMintFee(uint256 _mintFee) public onlyOwner {
        mintFee = _mintFee;
        emit MintFeeUpdated(_mintFee);
    }

    /**
     * @notice Withdraws the contract balance to the owner.
     */
    function withdraw() public onlyOwner {
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
        string memory _handle
    ) public canMint(_userAddress, _handle, _platformId) onlyOwner {
        _safeMint(_userAddress, nextTokenId.current());
        _afterMint(_userAddress, _handle, _platformId, 0);
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update handle address mapping and emit event after mint.
     * @dev Increments the nextTokenId counter.
     * @param _handle Handle for the user
     * @param _platformId Platform ID from which UserId was minted
     */
    function _afterMint(address _userAddress, string memory _handle, uint256 _platformId, uint256 _fee) private {
        uint256 userTokenId = nextTokenId.current();
        nextTokenId.increment();
        Profile storage profile = profiles[userTokenId];
        profile.platformId = _platformId;
        profile.handle = _handle;
        takenHandles[_handle] = true;
        _ids[_userAddress] = userTokenId;

        emit Mint(_userAddress, userTokenId, _handle, _platformId, _fee);
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
     * @dev Blocks the transferFrom function
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param tokenId The token ID to transfer
     */
    function transferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721Upgradeable) {}

    /**
     * @dev Blocks the safeTransferFrom function
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param tokenId The token ID to transfer
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721Upgradeable) {}

    /**
     * @dev Blocks the burn function
     * @param _tokenId The ID of the token
     */
    function _burn(uint256 _tokenId) internal virtual override(ERC721Upgradeable) {}

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
        string memory username = profiles[id].handle;

        bytes memory image = abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64Upgradeable.encode(
                bytes(
                    abi.encodePacked(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="100%" height="100%"/><svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" version="1.2" viewBox="-200 -50 1000 1000"><path fill="#FFFFFF" d="M264.5 190.5c0-13.8 11.2-25 25-25H568c13.8 0 25 11.2 25 25v490c0 13.8-11.2 25-25 25H289.5c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M265 624c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25v56.5c0 13.8-11.2 25-25 25H290c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M0 190.5c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25V247c0 13.8-11.2 25-25 25H25c-13.8 0-25-11.2-25-25z"/></svg><text x="30" y="670" style="font:60px sans-serif;fill:#fff">',
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
     * @notice Check if _msgSender() can pay the mint fee.
     */
    modifier canPay() {
        require(msg.value == mintFee, "Incorrect amount of ETH for mint fee");
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
        string memory _handle,
        uint256 _platformId
    ) {
        require(numberMinted(_userAddress) == 0, "You already have a TalentLayerID");
        require(bytes(_handle).length >= 2, "Handle too short");
        require(bytes(_handle).length <= 20, "Handle too long");
        require(!takenHandles[_handle], "Handle already taken");
        talentLayerPlatformIdContract.isValid(_platformId);
        _;
    }

    /**
     * @notice Check if the given address is either the owner of the delegate of the given tokenId
     * @param _tokenId Token ID to check
     */
    modifier onlyOwnerOrDelegate(uint256 _tokenId) {
        require(isOwnerOrDelegate(_tokenId, _msgSender()), "Not owner or delegate");
        _;
    }

    // =========================== Events ==============================

    /**
     * Emit when new TalentLayerID is minted.
     * @param _user Address of the owner of the TalentLayerID
     * @param _tokenId TalentLayer ID for the user
     * @param _handle Handle for the user
     * @param _platformId Platform ID from which UserId was minted
     * @param _fee Fee paid to mint the TalentLayerID
     */
    event Mint(address indexed _user, uint256 _tokenId, string _handle, uint256 _platformId, uint256 _fee);

    /**
     * Emit when Cid is updated for a user.
     * @param _tokenId TalentLayer ID for the user
     * @param _newCid Content ID
     */
    event CidUpdated(uint256 indexed _tokenId, string _newCid);

    /**
     * Emit when mint fee is updated
     * @param _mintFee The new mint fee
     */
    event MintFeeUpdated(uint256 _mintFee);

    /**
     * Emit when a delegate is added for a user.
     * @param _tokenId TalentLayer ID for the user
     * @param _delegate Address of the delegate
     */
    event DelegateAdded(uint256 _tokenId, address _delegate);

    /**
     * Emit when a delegate is removed for a user.
     * @param _tokenId TalentLayer ID for the user
     * @param _delegate Address of the delegate
     */
    event DelegateRemoved(uint256 _tokenId, address _delegate);
}
