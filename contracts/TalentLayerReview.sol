// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";
import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerService} from "./interfaces/ITalentLayerService.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";

import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
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
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
contract TalentLayerReview is ERC2771RecipientUpgradeable, ERC721Upgradeable, UUPSUpgradeable {
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /**
     * @notice Review information struct
     * @param id the id of the review
     * @param ownerId the talentLayerId of the user who received the review
     * @param dataUri the IPFS URI of the review metadata
     * @param serviceId the id of the service of the review
     * @param rating the rating of the review
     */
    struct Review {
        uint256 id;
        uint256 ownerId;
        string dataUri;
        uint256 serviceId;
        uint256 rating;
    }

    /**
     * @notice Review id counter
     */
    CountersUpgradeable.Counter nextReviewId;

    /**
     * @notice Review id to review
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
     * @notice TalentLayer contract instance
     */
    ITalentLayerID private tlId;

    /**
     * @notice TalentLayerService
     */
    ITalentLayerService private talentLayerService;

    // =========================== Initializers ==============================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _talentLayerIdAddress, address _talentLayerServiceAddress) public initializer {
        __ERC721_init("TalentLayerReview", "TLR");
        __UUPSUpgradeable_init();
        __Ownable_init();
        tlId = ITalentLayerID(_talentLayerIdAddress);
        talentLayerService = ITalentLayerService(_talentLayerServiceAddress);
        // Increment counter to start review ids at index 1
        nextReviewId.increment();
    }

    // =========================== View functions ==============================

    /**
     * @notice Returns the review information
     * @param _reviewId The id of the review
     */
    function getReview(uint256 _reviewId) public view returns (Review memory) {
        require(_reviewId < nextReviewId.current(), "Invalid review ID");
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
     */
    function mint(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating
    ) public onlyOwnerOrDelegate(_profileId) returns (uint256) {
        ITalentLayerService.Service memory service = talentLayerService.getService(_serviceId);

        require(
            _profileId == service.ownerId || _profileId == service.acceptedProposalId,
            "Not an actor of this service"
        );
        require(service.status == ITalentLayerService.Status.Finished, "Service not finished yet");
        require(_rating <= 5, "Invalid rating");

        uint256 toId;
        if (_profileId == service.ownerId) {
            toId = service.acceptedProposalId;
            require(!hasSellerBeenReviewed[_serviceId], "Already minted");
            hasSellerBeenReviewed[_serviceId] = true;
        } else {
            toId = service.ownerId;
            require(!hasBuyerBeenReviewed[_serviceId], "Already minted");
            hasBuyerBeenReviewed[_serviceId] = true;
        }

        address sender = tlId.ownerOf(toId);
        _safeMint(sender, nextReviewId.current());
        return _afterMint(_serviceId, toId, _rating, _reviewUri);
    }

    // =========================== Private functions ===========================

    /**
     * @dev After the mint of a review
     * @param _serviceId The ID of the service linked to the review
     * @param _to The address of the recipient
     * @param _rating The review rate
     * @param _reviewUri The IPFS URI of the review
     */
    function _afterMint(
        uint256 _serviceId,
        uint256 _to,
        uint256 _rating,
        string calldata _reviewUri
    ) private returns (uint256) {
        uint256 reviewId = nextReviewId.current();
        nextReviewId.increment();

        reviews[reviewId] = Review({
            id: reviewId,
            ownerId: _to,
            dataUri: _reviewUri,
            serviceId: _serviceId,
            rating: _rating
        });

        emit Mint(_serviceId, _to, reviewId, _rating, _reviewUri);
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
    function _transfer(address, address, uint256) internal virtual override(ERC721Upgradeable) {
        revert("Token transfer is not allowed");
    }

    /**
     * @dev Blocks the burn function
     * @param _tokenId The ID of the token
     */
    function _burn(uint256 _tokenId) internal virtual override(ERC721Upgradeable) {}

    /**
     * @notice Implementation of the {IERC721Metadata-tokenURI} function.
     */
    function tokenURI(uint256) public view virtual override(ERC721Upgradeable) returns (string memory) {
        return _buildTokenURI();
    }

    /**
     * @notice Builds the token URI
     */
    function _buildTokenURI() internal pure returns (string memory) {
        bytes memory image = abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64Upgradeable.encode(
                bytes(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="100%" height="100%"/><svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" version="1.2" viewBox="-200 -50 1000 1000"><path fill="#FFFFFF" d="M264.5 190.5c0-13.8 11.2-25 25-25H568c13.8 0 25 11.2 25 25v490c0 13.8-11.2 25-25 25H289.5c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M265 624c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25v56.5c0 13.8-11.2 25-25 25H290c-13.8 0-25-11.2-25-25z"/><path fill="#FFFFFF" d="M0 190.5c0-13.8 11.2-25 25-25h543c13.8 0 25 11.2 25 25V247c0 13.8-11.2 25-25 25H25c-13.8 0-25-11.2-25-25z"/></svg><text x="30" y="670" style="font:60px sans-serif;fill:#fff">review</text></svg>'
                )
            )
        );
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64Upgradeable.encode(
                        bytes(abi.encodePacked('{"name":"TalentLayer Review"', ', "image":"', image, unicode'"}'))
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
     * @param serviceId The ID of the service
     * @param toId The TalentLayer Id of the recipient
     * @param tokenId The ID of the review token
     * @param rating The rating of the review
     * @param reviewUri The IPFS URI of the review metadata
     */
    event Mint(
        uint256 indexed serviceId,
        uint256 indexed toId,
        uint256 indexed tokenId,
        uint256 rating,
        string reviewUri
    );
}
