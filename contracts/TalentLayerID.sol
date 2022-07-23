// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC721A} from "./ERC721A.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IProofOfHumanity} from "./IProofOfHumanity.sol";

/**
 * @title TalentLayer ID Contract
 * @author TalentLayer Team @ ETHCC22 Hackathon
 */

contract TalentLayerID is ERC721A, Ownable {
    /// Proof of Humanity registry
    IProofOfHumanity public pohRegistry;

    /// TalentLayer handle to user address mapping
    mapping(string => address) public handles;

    /// Token ID to Proof of Humanity address mapping
    mapping(uint256 => address) public talentIdPohAddresses;

    /// Token ID to IPFS URI mapping
    mapping(uint256 => string) public profilesData;

    /// Base IPFS Token URI
    string _baseTokenURI;

    /// Account recovery merkle root
    bytes32 public recoveryRoot;

    /// Addresses that have successfully recovered their account
    mapping(address => bool) public hasBeenRecovered;

    /**
     * @param _baseURI IPFS base URI for tokens
     * @param _pohAddress Proof of Humanity registry address
     */
    constructor(string memory _baseURI, address _pohAddress)
        ERC721A("TalentLayerID", "TID")
    {
        setBaseURI(_baseURI);
        pohRegistry = IProofOfHumanity(_pohAddress);
    }

    // =========================== View functions ==============================

    /**
     * Allows retrieval of number of minted TalentLayerIDs for a user.
     * @param _user Address of the owner of the TalentLayerID
     * @return the number of tokens minted by the user
     */
    function numberMinted(address _user) public view returns (uint256) {
        return balanceOf(_user);
    }

    /**
     * Allows checking if Proof of Humanity address linked to the TalentLayerID is registered.
     * @param _tokenId Token ID to check
     * @return true if Proof of Humanity address is registered, false otherwise
     */
    function isTokenPohRegistered(uint256 _tokenId) public view returns (bool) {
        return pohRegistry.isRegistered(talentIdPohAddresses[_tokenId]);
    }

    /**
     * Allows getting the TalentLayerID of one address
     * @param _owner Address to check
     * @return uint256 the id of the NFT
     */
    function walletOfOwner(address _owner) public view returns (uint256) {
        uint256 ownedTokenId;
        uint256 currentTokenId = _startTokenId();
        address latestOwnerAddress;

        while (currentTokenId <= totalSupply()) {
            TokenOwnership memory ownership = _ownershipOf(currentTokenId);

            if (!ownership.burned && ownership.addr != address(0)) {
                latestOwnerAddress = ownership.addr;
            }

            if (latestOwnerAddress == _owner) {
                ownedTokenId = currentTokenId;
                break;
            }

            currentTokenId++;
        }

        return ownedTokenId;
    }

    // =========================== User functions ==============================

    /**
     * Allows a user to mint a new TalentLayerID without the need of Proof of Humanity.
     * @param _handle Handle for the user
     */
    function mint(string memory _handle) public canMint(_handle) {
        _safeMint(msg.sender, 1);
        _afterMint(_handle);
    }

    /**
     * Allows a user to mint a new TalentLayerID with Proof of Humanity.
     * @param _handle Handle for the user
     */
    function mintWithPoh(string memory _handle) public canMint(_handle) {
        require(
            pohRegistry.isRegistered(msg.sender),
            "You need to use an address registered on Proof of Humanity"
        );
        _safeMint(msg.sender, 1);
        uint256 userTokenId = _nextTokenId() - 1;
        talentIdPohAddresses[userTokenId] = msg.sender;
        _afterMint(_handle);
    }

    /**
     * Link Proof of Humanity to previously non-linked TalentLayerID.
     * @param _tokenId Token ID to link
     */
    function activatePoh(uint256 _tokenId) public {
        require(ownerOf(_tokenId) == msg.sender);
        require(
            pohRegistry.isRegistered(msg.sender),
            "You need to use an address registered on Proof of Humanity"
        );
        talentIdPohAddresses[_tokenId] = msg.sender;
    }

    /**
     * Update user data.
     * @dev we are trusting the user to provide the valid IPFS URI (changing in v2)
     * @param _tokenId Token ID to update
     * @param _newCid New IPFS URI
     */
    function updateProfileData(uint256 _tokenId, string memory _newCid) public {
        require(ownerOf(_tokenId) == msg.sender);
        require(bytes(_newCid).length > 0, "Should provide a valid IPFS URI");
        profilesData[_tokenId] = _newCid;
    }

    /**
     * Allows recovery of a user's account with zero knowledge proofs.
     * @param _oldAddress Old user address
     * @param _tokenId Token ID to recover
     * @param _index Index in the merkle tree
     * @param _recoveryKey Recovery key
     * @param _handle User handle
     * @param _merkleProof Merkle proof
     */
    function recoverAccount(
        address _oldAddress,
        uint256 _tokenId,
        uint256 _index,
        uint256 _recoveryKey,
        string calldata _handle,
        bytes32[] calldata _merkleProof
    ) public {
        require(
            !hasBeenRecovered[_oldAddress],
            "This address has already been recovered"
        );
        require(
            ownerOf(_tokenId) == _oldAddress,
            "You are not the owner of this token"
        );
        require(numberMinted(msg.sender) == 0, "You already have a token");
        require(
            talentIdPohAddresses[_tokenId] == address(0),
            "Your old address was not linked to Proof of Humanity"
        );
        require(handles[_handle] == _oldAddress, "Invalid handle");
        require(
            pohRegistry.isRegistered(msg.sender),
            "You need to use an address registered on Proof of Humanity"
        );

        bytes32 node = keccak256(
            abi.encodePacked(_index, _recoveryKey, _handle, _oldAddress)
        );
        require(
            MerkleProof.verify(_merkleProof, recoveryRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        hasBeenRecovered[_oldAddress] = true;
        handles[_handle] = msg.sender;
        talentIdPohAddresses[_tokenId] = msg.sender;
        _internalTransferFrom(_oldAddress, msg.sender, _tokenId);
    }

    // =========================== Owner functions ==============================

    /**
     * Set new base uri
     * @param _newBaseURI new base IPFS uri
     */
    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        _baseTokenURI = _newBaseURI;
    }

    /**
     * Set new TalentLayer ID recovery root.
     * @param _newRoot New merkle root
     */
    function updateRecoveryRoot(bytes32 _newRoot) public onlyOwner {
        recoveryRoot = _newRoot;
    }

    // =========================== Private functions ==============================

    /**
     * Update handle address mapping and emit event after mint.
     * @param _handle Handle for the user
     */
    function _afterMint(string memory _handle) private {
        handles[_handle] = msg.sender;
        uint256 userTokenId = _nextTokenId() - 1;

        emit Mint(msg.sender, userTokenId, _handle);
    }

    // =========================== Internal functions ==============================

    /**
     * Update the start token id to 1
     */
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    // =========================== Overrides ==============================

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) {}

    // =========================== Modifiers ==============================

    /**
     * Check if user is able to mint a new TalentLayerID.
     * @param _handle Handle for the user
     */
    modifier canMint(string memory _handle) {
        require(
            numberMinted(msg.sender) == 0,
            "You already have a TalentLayerID"
        );
        require(bytes(_handle).length <= 10, "Handle too long");
        require(handles[_handle] == address(0));
        _;
    }

    // =========================== Events ==============================

    /**
     * Emit when new TalentLayerID is minted.
     * @param _user Address of the owner of the TalentLayerID
     * @param _tokenId TalentLayer ID for the user
     * @param _handle Handle for the user
     */
    event Mint(address indexed _user, uint256 _tokenId, string _handle);
}
