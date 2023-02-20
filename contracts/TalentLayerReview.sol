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
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
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
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /// @notice Review information struct
    /// @param id the id of the review
    /// @param ownerId the talentLayerId of the user who received the review
    /// @param dataUri the IPFS URI of the review metadata
    /// @param platformId the platform ID on which the service of the review was created
    /// @param serviceId the id of the service of the review
    /// @param rating the rating of the review
    struct Review {
        uint256 id;
        uint256 ownerId;
        string dataUri;
        uint256 platformId;
        uint256 serviceId;
        uint256 rating;
    }

    /**
     * @notice Review id counter
     */
    CountersUpgradeable.Counter nextReviewId;

    /**
     * @notice Review Id to Review struct
     * @dev reviewId => Review
     */
    mapping(uint256 => Review) public reviews;

    /**
     * @notice Mapping to record whether the buyer has been reviewed for a service
     */
    mapping(uint256 => bool) public hasBuyerBeenReviewed;

    /**
     * @notice Mapping to record whether the seller has been reviewed for a service
     */
    mapping(uint256 => bool) public hasSellerBeenReviewed;

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
        tlId = ITalentLayerID(_talentLayerIdAddress);
        talentLayerService = ITalentLayerService(_talentLayerServiceAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
        // Increment counter to start review ids at index 1
        nextReviewId.increment();
    }

    // =========================== View functions ==============================

    // get the data of the struct Review
    function getReview(uint256 _reviewId) public view returns (Review memory) {
        return reviews[_reviewId];
    }

    /**
     * @dev Returns the total number of tokens in existence.
     */
    function totalSupply() public view returns (uint256) {
        return nextReviewId.current() - 1;
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
    function mint(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) public onlyOwnerOrDelegate(_profileId) returns (uint256) {
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
            require(!hasSellerBeenReviewed[_serviceId], "You already minted a review for this service");
            hasSellerBeenReviewed[_serviceId] = true;
        } else {
            toId = service.ownerId;
            require(!hasBuyerBeenReviewed[_serviceId], "You already minted a review for this service");
            hasBuyerBeenReviewed[_serviceId] = true;
        }

        address sender = _msgSender();
        _safeMint(sender, nextReviewId.current());
        return _afterMint(_serviceId, toId, _rating, _reviewUri, _platformId);
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
    ) internal virtual returns (uint256) {
        require(_to != 0, "TalentLayerReview: mint to invalid address");
        require(_rating <= 5 && _rating >= 0, "TalentLayerReview: invalid rating");

        uint256 reviewId = nextReviewId.current();
        nextReviewId.increment();

        reviews[reviewId] = Review({
            id: reviewId,
            ownerId: _to,
            dataUri: _reviewUri,
            platformId: _platformId,
            serviceId: _serviceId,
            rating: _rating
        });

        emit Mint(_serviceId, _to, reviewId, _rating, _reviewUri, _platformId);
        return reviewId;
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
