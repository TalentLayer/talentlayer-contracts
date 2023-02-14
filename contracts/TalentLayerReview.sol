// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (token/ERC721/ERC721.sol)

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";
import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerService} from "./interfaces/ITalentLayerService.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team
 */
contract TalentLayerReview is
    ERC2771RecipientUpgradeable,
    ERC165Upgradeable,
    IERC721Upgradeable,
    IERC721MetadataUpgradeable,
    UUPSUpgradeable
{
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;

    // Struct Review
    struct Review {
        uint256 id;
        uint256 owner;
        string dataUri;
        uint256 platformId;
    }

    /**
     * @notice Token name
     */
    string private _name;

    /**
     * @notice Token symbol
     */
    string private _symbol;

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
     * @notice Mapping owner TalentLayer ID to token count
     */
    mapping(uint256 => uint256) private _talentLayerIdToReviewCount;

    /**
     * @notice Mapping to record whether a review token was minted by the buyer for a serviceId
     */
    mapping(uint256 => uint256) public nftMintedByServiceAndBuyerId;

    /**
     * @notice Mapping to record whether a review token was minted buy the seller for a serviceId
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
        string memory name_,
        string memory symbol_,
        address _talentLayerIdAddress,
        address _talentLayerServiceAddress,
        address _talentLayerPlatformIdAddress
    ) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        _totalSupply = 0;
        _name = name_;
        _symbol = symbol_;
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
     * @param _tokenId TalentLayer ID of the user
     * @param _serviceId Service ID
     * @param _reviewUri The IPFS URI of the review
     * @param _rating The review rate
     * @param _platformId The platform ID
     */
    function addReview(
        uint256 _tokenId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) public onlyOwnerOrDelegate(_tokenId) {
        ITalentLayerService.Service memory service = talentLayerService.getService(_serviceId);

        require(
            _tokenId == service.ownerId || _tokenId == service.acceptedProposalId,
            "You're not an actor of this service"
        );
        require(service.status == ITalentLayerService.Status.Finished, "The service is not finished yet");
        talentLayerPlatformIdContract.isValid(_platformId);

        uint256 toId;
        if (_tokenId == service.ownerId) {
            toId = service.acceptedProposalId;
            if (nftMintedByServiceAndBuyerId[_serviceId] == _tokenId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndBuyerId[_serviceId] = _tokenId;
            }
        } else {
            toId = service.ownerId;
            if (nftMintedByServiceAndSellerId[_serviceId] == _tokenId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndSellerId[_serviceId] = _tokenId;
            }
        }

        _mint(_serviceId, toId, _rating, _reviewUri, _platformId);
    }

    // =========================== Private functions ===========================

    /**
     * @notice Called after each safe transfer to verify whether the recipient received the token
     * @param _from The address of the sender
     * @param _to The address of the recipient
     * @param _tokenId The ID of the review token
     * @param _data Additional data with no specified format
     */
    function _checkOnERC721Received(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (_to.isContract()) {
            try IERC721ReceiverUpgradeable(_to).onERC721Received(_msgSender(), _from, _tokenId, _data) returns (
                bytes4 retval
            ) {
                return retval == IERC721ReceiverUpgradeable.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("TalentLayerReview: transfer to non ERC721Receiver implementer");
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    // =========================== Internal functions ==========================

    /**
     * @dev Override to block this function
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev Transfers a token from one owner to another
     * @param _from The address of the sender
     * @param _to The address of the recipient
     * @param _tokenId The ID of the review token
     * @param _data Additional data with no specified format
     */
    function _safeTransfer(address _from, address _to, uint256 _tokenId, bytes memory _data) internal virtual {
        _transfer(_from, _to, _tokenId);
        require(
            _checkOnERC721Received(_from, _to, _tokenId, _data),
            "TalentLayerReview: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev CHeck whether a review token exists
     * @param _tokenId The ID of the review token
     */
    function _exists(uint256 _tokenId) internal view virtual returns (bool) {
        return reviews[_tokenId].id != 0;
    }

    /**
     * @dev Checks whether an operator the owner of a token or whether he is approved
      to perform operations on behalf of a user
     * @param _spender The address of the operator
     * @param _tokenId The ID of the review token
     */
    function _isApprovedOrOwner(address _spender, uint256 _tokenId) internal view virtual returns (bool) {
        address owner = TalentLayerReview.ownerOf(_tokenId);
        return (_spender == owner || isApprovedForAll(owner, _spender) || getApproved(_tokenId) == _spender);
    }

    /**
     * @dev Mints a review token
     * @param _serviceId The ID of the service linked to the review
     * @param _to The address of the recipient
     * @param _rating The review rate
     * @param _reviewUri The IPFS URI of the review
     * @param _platformId The platform ID
     * Emits a "Mint" event
     */
    function _mint(
        uint256 _serviceId,
        uint256 _to,
        uint256 _rating,
        string calldata _reviewUri,
        uint256 _platformId
    ) internal virtual {
        require(_to != 0, "TalentLayerReview: mint to invalid address");
        require(_rating <= 5 && _rating >= 0, "TalentLayerReview: invalid rating");

        _talentLayerIdToReviewCount[_to] += 1;

        reviews[_totalSupply] = Review({id: _totalSupply, owner: _to, dataUri: _reviewUri, platformId: _platformId});

        _totalSupply = _totalSupply + 1;

        emit Mint(_serviceId, _to, _totalSupply, _rating, _reviewUri, _platformId);
    }

    /**
     * @dev Blocks the burn function
     * @param _tokenId The ID of the review token
     */
    function _burn(uint256 _tokenId) internal virtual {}

    /**
     * @dev Bocks the transfer function to restrict the use to only safe transfer
     * @param _from The address of the sender
     * @param _to The address of the recipient
     * @param _tokenId The ID of the review token
     */
    function _transfer(address _from, address _to, uint256 _tokenId) internal virtual {}

    /**
     * @dev Approves an operator to perform operations on a token
     * @param _to The address of the operator
     * @param _tokenId The ID of the review token
     */
    function _approve(address _to, uint256 _tokenId) internal virtual {
        _tokenApprovals[_tokenId] = _to;
        emit Approval(TalentLayerReview.ownerOf(_tokenId), _to, _tokenId);
    }

    /**
     * @dev Gives the approval to an operator to perform operations on behalf of a user
     * @param _owner The user
     * @param _operator The operator
     * @param _approved The approval status
     */
    function _setApprovalForAll(address _owner, address _operator, bool _approved) internal virtual {
        require(_owner != _operator, "TalentLayerReview: approve to caller");
        _operatorApprovals[_owner][_operator] = _approved;
        emit ApprovalForAll(_owner, _operator, _approved);
    }

    /**
     * @dev Unused hook.
     */
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual {}

    /**
     * @dev Unused hook.
     */
    function _afterTokenTransfer(address from, address to, uint256 tokenId) internal virtual {}

    function _authorizeUpgrade(address newImplementation) internal override(UUPSUpgradeable) onlyOwner {}

    // =========================== External functions ==========================

    // =========================== Overrides ===================================

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165Upgradeable, IERC165Upgradeable) returns (bool) {
        return
            interfaceId == type(IERC721Upgradeable).interfaceId ||
            interfaceId == type(IERC721MetadataUpgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IER721A-balanceOf}.
     */
    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "TalentLayerReview: token zero is not a valid owner");

        return _talentLayerIdToReviewCount[tlId.ids(owner)];
    }

    /**
     * @dev See {IER721A-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = tlId.ownerOf(reviews[tokenId].id);
        require(owner != address(0), "TalentLayerReview: invalid token ID");
        return owner;
    }

    /**
     * @dev See {IER721A-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IER721A-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IER721A-tokenUri}.
     */
    function tokenURI(uint256 tokenId) public view virtual override RequireMinted(tokenId) returns (string memory) {
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    /**
     * @dev See {IER721A-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = TalentLayerReview.ownerOf(tokenId);
        require(to != owner, "TalentLayerReview: approval to current owner");

        address sender = _msgSender();
        require(
            sender == owner || isApprovedForAll(owner, sender),
            "TalentLayerReview: approve caller is not token owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IER721A-getApproved}.
     */
    function getApproved(uint256 _tokenId) public view virtual override RequireMinted(_tokenId) returns (address) {
        return _tokenApprovals[_tokenId];
    }

    /**
     * @dev See {IER721A-setApprovedForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IER721A-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    /**
     * @dev See {IER721A-transferFrom}.
     */
    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "TalentLayerReview: caller is not token owner nor approved");

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IER721A-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IER721A-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "TalentLayerReview: caller is not token owner nor approved");
        _safeTransfer(from, to, tokenId, data);
    }

    // =========================== Modifiers ===================================

    /**
     * @dev Throws an error if _tokenId does not exist
     * @param _tokenId The ID of the review token
     */
    modifier RequireMinted(uint256 _tokenId) {
        _;
        require(_exists(_tokenId), "TalentLayerReview: invalid token ID");
    }

    // =========================== Modifiers ==============================

    /**
     * @notice Check if the given address is either the owner of the delegate of the given tokenId
     * @param _tokenId the tokenId
     */
    modifier onlyOwnerOrDelegate(uint256 _tokenId) {
        require(tlId.isOwnerOrDelegate(_tokenId, _msgSender()), "Not owner or delegate");
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
