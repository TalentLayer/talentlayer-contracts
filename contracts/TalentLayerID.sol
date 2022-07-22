// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import 'erc721a/contracts/ERC721A.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IProofOfHumanity.sol';

contract TalentLayerID is ERC721A, Ownable {
    IProofOfHumanity public pohRegistry;
    mapping(string => address) public handles;
    mapping(uint256 => address) public isPohRegistered;
    mapping(uint256 => string) public profilesData;
    string _baseTokenURI;

    event Mint(
        address indexed minter,
        uint256 talentLayerID,
        string handle
    );

    modifier canMint(string memory handle) {
        require(numberMinted(msg.sender) == 0, "You already have a TalentLayerID");
        require(bytes(handle).length <= 10, "Handle too long");
        require(handles[handle] == address(0) );
        _;
    }

    constructor(string memory _baseURI, address _pohAddress) ERC721A("TalentLayerID", "TID")  {
        setBaseURI(_baseURI);
        pohRegistry = IProofOfHumanity(_pohAddress);
    }

    function mint(string memory handle) public canMint(handle) {
        _safeMint(msg.sender, 1);
        _afterMint(handle);
    }

    function mintWithPoh(string memory handle) public canMint(handle) {
        require(pohRegistry.isRegistered(msg.sender), "POH is mandatory here");
        _safeMint(msg.sender, 1);
        uint256 userTokenId = _nextTokenId() - 1;
        isPohRegistered[userTokenId] = msg.sender;
        _afterMint(handle);
    }

    function activatePoh(uint256 _nftId) public {
        require(ownerOf(_nftId) == msg.sender);
        require(pohRegistry.isRegistered(msg.sender), "POH is mandatory here");
        isPohRegistered[_nftId] = msg.sender;
    }

    function updateProfileData(uint256 _nftId, string memory _cid) public {
        require(ownerOf(_nftId) == msg.sender);
        require(bytes(_cid).length > 0, "_cid should not be empty");
        profilesData[_nftId] = _cid;
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function numberMinted(address owner) public view returns (uint256) {
        return _numberMinted(owner);
    }

    function _afterMint(string memory handle) private {
        handles[handle] = msg.sender;
        uint256 userTokenId = _nextTokenId() - 1;

        emit Mint(
            msg.sender, 
            userTokenId,
            handle
        );
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) { }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) { }
}