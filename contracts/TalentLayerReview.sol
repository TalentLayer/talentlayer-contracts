// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.7.0) (token/ERC721/ERC721.sol)

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {IServiceRegistry} from "./interfaces/IServiceRegistry.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team
 */
contract TalentLayerReview is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

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
    uint256 public _totalSupply = 0;

    /**
     * @notice Mapping from Review ID to owner address
     */
    mapping(uint256 => uint256) private _reviewIdToOwnerAddress;

    /**
     * @notice Mapping owner TalentLayer ID to token count
     */
    mapping(uint256 => uint256) private _talentLayerIdToReviewCount;

    /**
     * @notice Mapping from Review Token ID to IPFS URI mapping
     */
    mapping(uint256 => string) public reviewDataUri;

    /**
     * @notice Mapping to record whether a review token was minted buy the buyer for a serviceId
     */
    mapping(uint256 => uint256) public nftMintedByServiceAndBuyerId;

    /**
     * @notice Mapping to record whether a review token was minted buy the seller for a serviceId
     */
    mapping(uint256 => uint256) public nftMintedByServiceAndSellerId;

    /**
     * @notice Mapping from Review ID to Platform ID
     */
    mapping(uint256 => uint256) public reviewIdToPlatformId;

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
     * @notice Service registry
     */
    IServiceRegistry private serviceRegistry;

    /**
     * @notice TalentLayer Platform ID registry
     */
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    constructor(
        string memory name_,
        string memory symbol_,
        address _talentLayerIdAddress,
        address _serviceRegistryAddress,
        address _talentLayerPlatformIdAddress
    ) {
        _name = name_;
        _symbol = symbol_;
        tlId = ITalentLayerID(_talentLayerIdAddress);
        serviceRegistry = IServiceRegistry(_serviceRegistryAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
    }

    // =========================== View functions ==============================

    // =========================== User functions ==============================

    /**
     * @notice Called to mint a review token for a completed service
     * @dev Only one review can be minted per user
     * @param _serviceId Service ID
     * @param _reviewUri The IPFS URI of the review
     * @param _rating The review rate
     * @param _platformId The platform ID
     */
    function addReview(
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) public {
        IServiceRegistry.Service memory service = serviceRegistry.getService(_serviceId);
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(
            senderId == service.buyerId || senderId == service.sellerId,
            "You're not an actor of this service"
        );
        require(
            service.status == IServiceRegistry.Status.Finished,
            "The service is not finished yet"
        );
        talentLayerPlatformIdContract.isValid(_platformId);

        uint256 toId;
        if (senderId == service.buyerId) {
            toId = service.sellerId;
            if (nftMintedByServiceAndBuyerId[_serviceId] == senderId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndBuyerId[_serviceId] = senderId;
            }
        } else {
            toId = service.buyerId;
            if (nftMintedByServiceAndSellerId[_serviceId] == senderId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByServiceAndSellerId[_serviceId] = senderId;
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
            try
            IERC721Receiver(_to).onERC721Received(
                _msgSender(),
                _from,
                _tokenId,
                _data
            )
            returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert(
                    "TalentLayerReview: transfer to non ERC721Receiver implementer"
                    );
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
    function _safeTransfer(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) internal virtual {
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
        return _reviewIdToOwnerAddress[_tokenId] != 0;
    }

    /**
     * @dev Checks whether an operator the owner of a token or whether he is approved
      to perform operations on behalf of a user
     * @param _spender The address of the operator
     * @param _tokenId The ID of the review token
     */
    function _isApprovedOrOwner(
        address _spender,
        uint256 _tokenId
    ) internal view virtual returns (bool) {
        address owner = TalentLayerReview.ownerOf(_tokenId);
        return (_spender == owner ||
        isApprovedForAll(owner, _spender) ||
        getApproved(_tokenId) == _spender);
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
        require(
            _rating <= 5 && _rating >= 0,
            "TalentLayerReview: invalid rating"
        );

        _talentLayerIdToReviewCount[_to] += 1;
        _reviewIdToOwnerAddress[_totalSupply] = _to;
        reviewDataUri[_totalSupply] = _reviewUri;
        reviewIdToPlatformId[_totalSupply] = _platformId;
        _totalSupply = _totalSupply + 1;

        emit Mint(_serviceId, _to, _totalSupply, _rating, _reviewUri, _platformId);
    }

    /**
     * @dev Blocks the burn functionburn
     * @param _tokenId The ID of the review token
     */
    function _burn(uint256 _tokenId) internal virtual {}

    /**
     * @dev Bocks the transfer function to restrict the use to only safe transfer
     * @param _from The address of the sender
     * @param _to The address of the recipient
     * @param _tokenId The ID of the review token
     */
    function _transfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual {}

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
    function _setApprovalForAll(
        address _owner,
        address _operator,
        bool _approved
    ) internal virtual {
        require(_owner != _operator, "TalentLayerReview: approve to caller");
        _operatorApprovals[_owner][_operator] = _approved;
        emit ApprovalForAll(_owner, _operator, _approved);
    }

    /**
     * @dev Unused hook.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    /**
     * @dev Unused hook.
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}


    // =========================== External functions ==========================

    // =========================== Overrides ===================================

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165, IERC165) returns(bool) {
        return
        interfaceId == type(IERC721).interfaceId ||
        interfaceId == type(IERC721Metadata).interfaceId ||
        super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IER721A-balanceOf}.
     */
    function balanceOf(address owner) public view virtual override returns(uint256)
    {
        require(
            owner != address(0),
            "TalentLayerReview: token zero is not a valid owner"
        );

        return _talentLayerIdToReviewCount[tlId.walletOfOwner(owner)];
    }

    /**
     * @dev See {IER721A-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns(address)
    {
        address owner = tlId.ownerOf(_reviewIdToOwnerAddress[tokenId]);
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
    function tokenURI(uint256 tokenId) RequireMinted(tokenId)
    public
    view
    virtual
    override
    returns(string memory)
    {

        string memory baseURI = _baseURI();
        return
        bytes(baseURI).length > 0
        ? string(abi.encodePacked(baseURI, tokenId.toString()))
        : "";
    }

    /**
     * @dev See {IER721A-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = TalentLayerReview.ownerOf(tokenId);
        require(to != owner, "TalentLayerReview: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "TalentLayerReview: approve caller is not token owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IER721A-getApproved}.
     */
    function getApproved(uint256 _tokenId) RequireMinted(_tokenId)
    public
    view
    virtual
    override
    returns(address)
    {
        return _tokenApprovals[_tokenId];
    }

    /**
     * @dev See {IER721A-setApprovedForAll}.
     */
    function setApprovalForAll(address operator, bool approved)
    public
    virtual
    override
    {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IER721A-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator)
    public
    view
    virtual
    override
    returns (bool)
    {
        return _operatorApprovals[owner][operator];
    }

    /**
     * @dev See {IER721A-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        //solhint-disable-next-line max-line-length
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "TalentLayerReview: caller is not token owner nor approved"
        );

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IER721A-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IER721A-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public virtual override {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "TalentLayerReview: caller is not token owner nor approved"
        );
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
