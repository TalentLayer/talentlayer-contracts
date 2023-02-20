// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (token/ERC721/ERC721.sol)

pragma solidity ^0.8.9;

import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";
import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerService} from "./interfaces/ITalentLayerService.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team
 */
contract TalentLayerReview is ERC2771RecipientUpgradeable, ERC721Upgradeable, UUPSUpgradeable {
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;

    // Struct Review
    struct Review {
        uint256 id;
        uint256 owner;
        string dataUri;
        uint256 platformId;
        uint256 serviceId;
        uint256 rating;
    }

    /**
     * @notice Number of review tokens
     */
    uint256 public _totalSupply;

    /**
     * @notice Review Id to Review struct
     * @dev reviewId => Review
     */
    mapping(uint256 => Review) public reviews;

    /**
     * @notice Mapping to record whether a review token was minted by the buyer for a serviceId
     * TODO: make this boolean?
     */
    mapping(uint256 => uint256) public nftMintedByServiceAndBuyerId;

    /**
     * @notice Mapping to record whether a review token was minted by the seller for a serviceId
     */
    mapping(uint256 => uint256) public nftMintedByServiceAndSellerId;

    /**
     * @notice Mapping from review token ID to approved address
     */
    mapping(uint256 => address) private _tokenApprovals;

    /**
     * @notice Mapping from owner to operator approvals
     */
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**
     * @notice Error thrown when caller already minted a review
     */
    error ReviewAlreadyMinted();

    /**
     * @notice TalentLayer contract instance
     */
    ITalentLayerID private tlId;

    /**
     * @notice TalentLayerService
     */
    ITalentLayerService private talentLayerService;

    /**
     * @notice TalentLayer Platform ID registry
     */
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    // =========================== Initializers ==============================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _talentLayerIdAddress,
        address _talentLayerServiceAddress,
        address _talentLayerPlatformIdAddress
    ) public initializer {
        __ERC721_init("TalentLayerReview", "TLR");
        __UUPSUpgradeable_init();
        __Ownable_init();
        _totalSupply = 0;
        tlId = ITalentLayerID(_talentLayerIdAddress);
        talentLayerService = ITalentLayerService(_talentLayerServiceAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
    }

    // =========================== View functions ==============================

    // get the data of the struct Review
    function getReview(uint256 _reviewId) public view returns (Review memory) {
        return reviews[_reviewId];
    }

    // =========================== User functions ==============================

    /**
     * @notice Called to mint a review token for a completed service
     * @dev Only one review can be minted per user
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId Service ID
     * @param _reviewUri The IPFS URI of the review
     * @param _rating The review rate
     * @param _platformId The platform ID
     */
    function addReview(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) public onlyOwnerOrDelegate(_profileId) {
        ITalentLayerService.Service memory service = talentLayerService.getService(_serviceId);

        require(
            _profileId == service.ownerId || _profileId == service.acceptedProposalId,
            "You're not an actor of this service"
        );
        require(service.status == ITalentLayerService.Status.Finished, "The service is not finished yet");
        talentLayerPlatformIdContract.isValid(_platformId);

        uint256 toId;
        if (_profileId == service.ownerId) {
            toId = service.acceptedProposalId;
            if (nftMintedByServiceAndBuyerId[_serviceId] == _profileId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndBuyerId[_serviceId] = _profileId;
            }
        } else {
            toId = service.ownerId;
            if (nftMintedByServiceAndSellerId[_serviceId] == _profileId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndSellerId[_serviceId] = _profileId;
            }
        }

        address sender = _msgSender();
        _safeMint(sender, _totalSupply);
        _afterMint(_serviceId, toId, _rating, _reviewUri, _platformId);
    }

    // =========================== Private functions ===========================

    /**
     * @dev Mints a review token
     * @param _serviceId The ID of the service linked to the review
     * @param _to The address of the recipient
     * @param _rating The review rate
     * @param _reviewUri The IPFS URI of the review
     * @param _platformId The platform ID
     * Emits a "Mint" event
     */
    function _afterMint(
        uint256 _serviceId,
        uint256 _to,
        uint256 _rating,
        string calldata _reviewUri,
        uint256 _platformId
    ) internal virtual {
        require(_to != 0, "TalentLayerReview: mint to invalid address");
        require(_rating <= 5 && _rating >= 0, "TalentLayerReview: invalid rating");

        reviews[_totalSupply] = Review({
            id: _totalSupply,
            owner: _to,
            dataUri: _reviewUri,
            platformId: _platformId,
            serviceId: _serviceId,
            rating: _rating
        });

        _totalSupply = _totalSupply + 1;

        emit Mint(_serviceId, _to, _totalSupply, _rating, _reviewUri, _platformId);
    }

    // =========================== Internal functions ==========================

    /**
     * @notice Function that revert when `_msgSender()` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override(UUPSUpgradeable) onlyOwner {}

    // =========================== Overrides ===================================

    /**
     * @dev Override to prevent token transfer.
     */
    function transferFrom(address, address, uint256) public virtual override(ERC721Upgradeable) {
        revert("Token transfer is not allowed");
    }

    /**
     * @dev Override to prevent token transfer.
     */
    function safeTransferFrom(address, address, uint256) public virtual override(ERC721Upgradeable) {
        revert("Token transfer is not allowed");
    }

    /**
     * @dev Override to prevent token transfer.
     */
    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override(ERC721Upgradeable) {
        revert("Token transfer is not allowed");
    }

    /**
     * @dev Blocks the burn function
     * @param _tokenId The ID of the token
     */
    function _burn(uint256 _tokenId) internal virtual override(ERC721Upgradeable) {}

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
     * @notice Check if the given address is either the owner of the delegate of the given user
     * @param _profileId The TalentLayer ID of the user
     */
    modifier onlyOwnerOrDelegate(uint256 _profileId) {
        require(tlId.isOwnerOrDelegate(_profileId, _msgSender()), "Not owner or delegate");
        _;
    }

    // =========================== Events ======================================

    /**
     * @dev Emitted after a review token is minted
     * @param _serviceId The ID of the service
     * @param _toId The TalentLayer Id of the recipient
     * @param _tokenId The ID of the review token
     * @param _rating The rating of the review
     * @param _reviewUri The IPFS URI of the review metadata
     * @param _platformId The ID of the platform
     */
    event Mint(
        uint256 indexed _serviceId,
        uint256 indexed _toId,
        uint256 indexed _tokenId,
        uint256 _rating,
        string _reviewUri,
        uint256 _platformId
    );
}
