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
import {IJobRegistry} from "./interfaces/IJobRegistry.sol";

contract TalentLayerReview is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    uint256 public _totalSupply = 0;

    // Mapping from token ID to owner address
    mapping(uint256 => uint256) private _owners;

    // Mapping owner address to token count
    mapping(uint256 => uint256) private _balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /// Token ID to IPFS URI mapping
    mapping(uint256 => string) public reviewDataUri;

    // Mapping to save NFT minted for a jobId and employerId
    mapping(uint256 => uint256) public nftMintedByJobAndemployerId;

    // Mapping to save NFT minted for a jobId and employeeId
    mapping(uint256 => uint256) public nftMintedByJobAndemployeeId;

    // Mapping from Review ID to Platform ID
    mapping(uint256 => uint256) public reviewIdToPlatformId;

    error ReviewAlreadyMinted();

    ITalentLayerID private tlId;
    IJobRegistry private jobRegistry;

    constructor(
        string memory name_,
        string memory symbol_,
        address _talentLayerIdAddress,
        address _jobRegistryAddress
    ) {
        _name = name_;
        _symbol = symbol_;
        tlId = ITalentLayerID(_talentLayerIdAddress);
        jobRegistry = IJobRegistry(_jobRegistryAddress);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function balanceOf(address owner)
        public
        view
        virtual
        override
        returns (uint256)
    {
        require(
            owner != address(0),
            "TalentLayerReview: token zero is not a valid owner"
        );

        return _balances[tlId.walletOfOwner(owner)];
    }

    function ownerOf(uint256 tokenId)
        public
        view
        virtual
        override
        returns (address)
    {
        address owner = tlId.ownerOf(_owners[tokenId]);
        require(owner != address(0), "TalentLayerReview: invalid token ID");
        return owner;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        _requireMinted(tokenId);

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : "";
    }

    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    function approve(address to, uint256 tokenId) public virtual override {
        address owner = TalentLayerReview.ownerOf(tokenId);
        require(to != owner, "TalentLayerReview: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "TalentLayerReview: approve caller is not token owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId)
        public
        view
        virtual
        override
        returns (address)
    {
        _requireMinted(tokenId);

        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved)
        public
        virtual
        override
    {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        virtual
        override
        returns (bool)
    {
        return _operatorApprovals[owner][operator];
    }

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

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

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

    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal virtual {
        _transfer(from, to, tokenId);
        require(
            _checkOnERC721Received(from, to, tokenId, data),
            "TalentLayerReview: transfer to non ERC721Receiver implementer"
        );
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != 0;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        virtual
        returns (bool)
    {
        address owner = TalentLayerReview.ownerOf(tokenId);
        return (spender == owner ||
            isApprovedForAll(owner, spender) ||
            getApproved(tokenId) == spender);
    }

    function _mint(
        uint256 jobId,
        uint256 to,
        uint256 _rating,
        string calldata reviewUri,
        uint256 _platformId
    ) internal virtual {
        require(to != 0, "TalentLayerReview: mint to invalid address");
        require(
            _rating <= 5 && _rating >= 0,
            "TalentLayerReview: invalid rating"
        );

        _balances[to] += 1;
        _owners[_totalSupply] = to;
        reviewDataUri[_totalSupply] = reviewUri;
        reviewIdToPlatformId[_totalSupply] = _platformId;
        _totalSupply = _totalSupply + 1;

        emit Mint(jobId, to, _totalSupply, _rating, reviewUri, _platformId);
    }

    function _burn(uint256 tokenId) internal virtual {}

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(TalentLayerReview.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll(
        address owner,
        address operator,
        bool approved
    ) internal virtual {
        require(owner != operator, "TalentLayerReview: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "TalentLayerReview: invalid token ID");
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.isContract()) {
            try
                IERC721Receiver(to).onERC721Received(
                    _msgSender(),
                    from,
                    tokenId,
                    data
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

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    event Mint(
        uint256 indexed _jobId,
        uint256 indexed _toId,
        uint256 indexed _tokenId,
        uint256 _rating,
        string _reviewUri,
        uint256 _platformId
    );

    function addReview(
        uint256 _jobId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) public {
        IJobRegistry.Job memory job = jobRegistry.getJob(_jobId);
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(
            senderId == job.employerId || senderId == job.employeeId,
            "You're not an actor of this job"
        );
        require(
            job.status == IJobRegistry.Status.Finished,
            "The job is not finished yet"
        );
        require(
            _platformId > 0, "Platform 0 is not a valid TalentLayer Platform ID"
        );

        uint256 toId;
        if (senderId == job.employerId) {
            toId = job.employeeId;
            if (nftMintedByJobAndemployerId[_jobId] == senderId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByJobAndemployerId[_jobId] = senderId;
            }
        } else {
            toId = job.employerId;
            if (nftMintedByJobAndemployeeId[_jobId] == senderId) {
                revert ReviewAlreadyMinted();
            } else {
                nftMintedByJobAndemployeeId[_jobId] = senderId;
            }
        }

        _mint(_jobId, toId, _rating, _reviewUri, _platformId);
    }
}
