// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ERC721A} from "./libs/ERC721A.sol";

import "./Arbitrator.sol";

/**
 * @title Platform ID Contract
 * @author TalentLayer Team
 */
contract TalentLayerPlatformID is ERC721A, AccessControl {
    // =========================== Structs ==============================

    /// @notice TalentLayer Platform information struct
    /// @param platformId the TalentLayer Platform Id
    /// @param name the name of the platform
    /// @param dataUri the IPFS URI of the Platform metadata
    /// @param fee the %fee (per ten thousands) asked by the platform for each job escrow transaction
    /// @param arbitrator address of the arbitrator used by the platform
    /// @param arbitratorExtraData extra information for the arbitrator
    /// @param arbitrationFeeTimeout timeout for parties to pay the arbitration fee
    struct Platform {
        uint256 id;
        string name;
        string dataUri;
        uint16 fee;
        Arbitrator arbitrator;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
    }

    /**
     * @notice Account recovery merkle root
     */
    bytes32 public recoveryRoot;

    /**
     * @notice Taken Platform name
     */
    mapping(string => bool) public takenNames;

    /**
     * @notice Token ID to Platfom struct
     */
    mapping(uint256 => Platform) public platforms;

    /**
     * @notice Addresses that have successfully recovered their account
     */
    mapping(address => bool) public hasBeenRecovered;

    /**
     * @notice Addresses which are available as arbitrators
     */
    mapping(address => bool) public validArbitrators;

    /**
     * @notice Whether arbitrators are internal (are part of TalentLayer) or not
     *         Internal arbitrators will have the extra data set to the platform ID
     */
    mapping(address => bool) public internalArbitrators;

    /// Price to mint a platform id (in wei, upgradable)
    uint256 public mintFee;

    /**
     * @notice Role granting Minting permission
     */
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

    /**
     * @notice Minimum duration for arbitration fee timeout
     */
    uint256 MIN_ARBITRATION_FEE_TIMEOUT = 1 days;

    constructor() ERC721A("TalentLayerPlatformID", "TPID") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINT_ROLE, msg.sender);
        mintFee = 0;
        validArbitrators[address(0)] = true; // The zero address means no arbitrator.
    }

    // =========================== View functions ==============================

    /**
     * @notice Allows retrieval of number of minted Platform IDs for a platform.
     * @param _platformAddress Address of the owner of the Platform ID
     * @return the number of tokens minted by the platform
     */
    function numberMinted(address _platformAddress) public view returns (uint256) {
        return balanceOf(_platformAddress);
    }

    function getPlatformFee(uint256 _platformId) external view returns (uint16) {
        return platforms[_platformId].fee;
    }

    function getPlatform(uint256 _platformId) external view returns (Platform memory) {
        require(_platformId > 0 && _platformId <= totalSupply(), "This plateForm Id is not valid");
        return platforms[_platformId];
    }

    /**
     * @notice Allows getting the Platform ID from an address
     * @param _owner Platform Address to check
     * @return uint256 the Platform Id associated to this address
     */
    function getPlatformIdFromAddress(address _owner) public view returns (uint256) {
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
     * @notice Allows a platform to mint a new Platform Id without the need of Proof of Humanity.
     * @dev You need to have MINT_ROLE to use this function
     * @param _platformName Platform name
     */
    function mint(string memory _platformName) public payable canMint(_platformName, msg.sender) onlyRole(MINT_ROLE) {
        _safeMint(msg.sender, 1);
        _afterMint(_platformName, msg.sender);
    }

    /**
     * @notice Allows a user to mint a new Platform Id and assign it to an eth address without the need of Proof of Humanity.
     * @dev You need to have MINT_ROLE to use this function
     * @param _platformName Platform name
     * @param _platformAddress Eth Address to assign the Platform Id to
     */
    function mintForAddress(string memory _platformName, address _platformAddress)
        public
        payable
        canMint(_platformName, _platformAddress)
        onlyRole(MINT_ROLE)
    {
        _safeMint(_platformAddress, 1);
        _afterMint(_platformName, _platformAddress);
    }

    /**
     * @notice Update platform URI data.
     * @dev we are trusting the platform to provide the valid IPFS URI
     * @param _platformId Token ID to update
     * @param _newCid New IPFS URI
     */
    function updateProfileData(uint256 _platformId, string memory _newCid) public {
        require(ownerOf(_platformId) == msg.sender);
        require(bytes(_newCid).length > 0, "Should provide a valid IPFS URI");

        platforms[_platformId].dataUri = _newCid;

        emit CidUpdated(_platformId, _newCid);
    }

    /**
     * @notice Allows a platform to update his fee
     * @param _platformFee Platform fee to update
     */
    function updatePlatformFee(uint256 _platformId, uint16 _platformFee) public {
        require(ownerOf(_platformId) == msg.sender, "You're not the owner of this platform");

        platforms[_platformId].fee = _platformFee;
        emit PlatformFeeUpdated(_platformId, _platformFee);
    }

    /**
     * @notice Allows a platform to update his arbitrator
     * @param _arbitrator the arbitrator
     * @param _extraData the extra data for arbitrator (this is only used for external arbitrators, for
     *                   internal arbitrators it should be empty)
     */
    function updateArbitrator(
        uint256 _platformId,
        Arbitrator _arbitrator,
        bytes memory _extraData
    ) public {
        require(ownerOf(_platformId) == msg.sender, "You're not the owner of this platform");
        require(validArbitrators[address(_arbitrator)], "The address must be of a valid arbitrator");

        platforms[_platformId].arbitrator = _arbitrator;

        if (internalArbitrators[address(_arbitrator)]) {
            platforms[_platformId].arbitratorExtraData = abi.encodePacked(_platformId);
        } else {
            platforms[_platformId].arbitratorExtraData = _extraData;
        }

        emit ArbitratorUpdated(_platformId, _arbitrator, platforms[_platformId].arbitratorExtraData);
    }

    /**
     * @notice Allows a platform to update the timeout for paying the arbitration fee
     * @param _arbitrationFeeTimeout The new timeout
     */
    function updateArbitrationFeeTimeout(uint256 _platformId, uint256 _arbitrationFeeTimeout) public {
        require(ownerOf(_platformId) == msg.sender, "You're not the owner of this platform");
        require(
            _arbitrationFeeTimeout >= MIN_ARBITRATION_FEE_TIMEOUT,
            "The timeout must be greater than the minimum timeout"
        );

        platforms[_platformId].arbitrationFeeTimeout = _arbitrationFeeTimeout;
        emit ArbitrationFeeTimeoutUpdated(_platformId, _arbitrationFeeTimeout);
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Set new Platform ID recovery root.
     * @param _newRoot New merkle root
     */
    function updateRecoveryRoot(bytes32 _newRoot) public onlyRole(DEFAULT_ADMIN_ROLE) {
        recoveryRoot = _newRoot;
    }

    /**
     * Updates the mint fee.
     * @param _mintFee The new mint fee
     */
    function updateMintFee(uint256 _mintFee) public onlyRole(DEFAULT_ADMIN_ROLE) {
        mintFee = _mintFee;
        emit MintFeeUpdated(_mintFee);
    }

    /**
     * Withdraws the contract balance to the admin.
     */
    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool sent, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(sent, "Failed to withdraw Ether");
    }

    /**
     * Adds a new available arbitrator.
     * @param _arbitrator address of the arbitrator
     * @param _isInternal whether the arbitrator is internal (is part of TalentLayer) or not
     */
    function addArbitrator(address _arbitrator, bool _isInternal) public onlyRole(DEFAULT_ADMIN_ROLE) {
        validArbitrators[address(_arbitrator)] = true;
        internalArbitrators[address(_arbitrator)] = _isInternal;
    }

    /**
     * Removes an available arbitrator.
     * @param _arbitrator address of the arbitrator
     */
    function removeArbitrator(address _arbitrator) public onlyRole(DEFAULT_ADMIN_ROLE) {
        validArbitrators[address(_arbitrator)] = false;
        internalArbitrators[address(_arbitrator)] = false;
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update Platform name mapping and emit event after mint.
     * @param _platformName Name of the platform
     */
    function _afterMint(string memory _platformName, address _platformAddress) private {
        uint256 platformId = _nextTokenId() - 1;
        Platform storage platform = platforms[platformId];
        platform.name = _platformName;
        platform.id = platformId;
        platform.arbitrationFeeTimeout = MIN_ARBITRATION_FEE_TIMEOUT;
        takenNames[_platformName] = true;

        emit Mint(_platformAddress, platformId, _platformName, mintFee);
    }

    // =========================== Internal functions ==============================

    /**
     * Update the start token id to 1
     */
    function _startTokenId() internal view virtual override(ERC721A) returns (uint256) {
        return 1;
    }

    // =========================== External functions ==============================

    /**
     * @notice Check whether the TalentLayer Platform Id is valid.
     * @param _platformId TalentLayer Platform ID
     */
    function isValid(uint256 _platformId) external view {
        require(_platformId > 0 && _platformId <= totalSupply(), "Invalid platform ID");
    }

    // =========================== Overrides ==============================

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721A, AccessControl) returns (bool) {
        return ERC721A.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) {
        revert("Not allowed");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721A) {
        revert("Not allowed");
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721A) returns (string memory) {
        return _buildTokenURI(tokenId);
    }

    function _buildTokenURI(uint256 id) internal view returns (string memory) {
        string memory platformName = platforms[id].name;

        bytes memory image = abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(
                bytes(
                    abi.encodePacked(
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"><defs><linearGradient id="a" x1="67.94" y1="169.48" x2="670.98" y2="562.86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#17a9c2"/><stop offset=".12" stop-color="#1aa9bc"/><stop offset=".29" stop-color="#25abab"/><stop offset=".48" stop-color="#35ad8f"/><stop offset=".64" stop-color="#48b072"/><stop offset=".78" stop-color="#59b254"/><stop offset="1" stop-color="#7ab720"/></linearGradient></defs><path style="fill:url(#a)" d="M0 0h720v720H0z"/><path d="M47.05 92.37V53.84H33.29V46h36.85v7.84H56.41v38.52h-9.36Zm35.71-23.34-8.07-1.46c.91-3.25 2.47-5.65 4.68-7.21 2.21-1.56 5.5-2.34 9.87-2.34 3.96 0 6.92.47 8.86 1.41 1.94.94 3.31 2.13 4.1 3.57s1.19 4.1 1.19 7.96l-.1 10.37c0 2.95.14 5.13.43 6.53.28 1.4.82 2.91 1.6 4.51h-8.79c-.23-.59-.52-1.47-.85-2.63-.15-.53-.25-.88-.32-1.04-1.52 1.48-3.14 2.58-4.87 3.32s-3.57 1.11-5.54 1.11c-3.46 0-6.18-.94-8.18-2.82-1.99-1.88-2.99-4.25-2.99-7.12 0-1.9.45-3.59 1.36-5.08s2.18-2.63 3.81-3.42 3.99-1.48 7.07-2.07c4.15-.78 7.03-1.51 8.63-2.18v-.89c0-1.71-.42-2.93-1.27-3.65s-2.44-1.09-4.78-1.09c-1.58 0-2.82.31-3.7.93-.89.62-1.6 1.71-2.15 3.27Zm11.89 7.21c-1.14.38-2.94.83-5.41 1.36-2.47.53-4.08 1.04-4.84 1.55-1.16.82-1.74 1.87-1.74 3.13s.46 2.32 1.39 3.23c.93.91 2.11 1.36 3.54 1.36 1.6 0 3.13-.53 4.59-1.58 1.08-.8 1.78-1.78 2.12-2.94.23-.76.35-2.2.35-4.33v-1.77Zm17.49 16.13V46h8.89v46.37h-8.89Zm37.45-10.69 8.86 1.49c-1.14 3.25-2.94 5.72-5.39 7.42s-5.53 2.55-9.22 2.55c-5.84 0-10.16-1.91-12.97-5.72-2.21-3.06-3.32-6.92-3.32-11.58 0-5.57 1.46-9.93 4.36-13.08 2.91-3.15 6.59-4.73 11.04-4.73 5 0 8.94 1.65 11.83 4.95s4.27 8.36 4.14 15.17h-22.27c.06 2.64.78 4.69 2.15 6.15 1.37 1.47 3.08 2.2 5.12 2.2 1.39 0 2.56-.38 3.51-1.14.95-.76 1.67-1.98 2.15-3.67Zm.51-8.98c-.06-2.57-.73-4.53-1.99-5.87-1.27-1.34-2.81-2.01-4.62-2.01-1.94 0-3.54.71-4.81 2.12-1.27 1.41-1.89 3.33-1.87 5.76h13.28Zm46.62 19.67h-8.89V75.23c0-3.63-.19-5.97-.57-7.04-.38-1.06-1-1.89-1.85-2.48s-1.88-.89-3.08-.89c-1.54 0-2.92.42-4.14 1.27s-2.06 1.96-2.51 3.35c-.45 1.39-.68 3.96-.68 7.72v15.21h-8.89V58.78h8.26v4.93c2.93-3.8 6.62-5.69 11.07-5.69 1.96 0 3.75.35 5.38 1.06 1.62.71 2.85 1.61 3.68 2.7.83 1.1 1.41 2.34 1.74 3.73s.49 3.38.49 5.98v20.88Zm24.42-33.59v7.08h-6.07V79.4c0 2.74.06 4.34.17 4.79.12.45.38.83.79 1.12.41.3.91.44 1.5.44.82 0 2.01-.28 3.57-.85l.76 6.9c-2.07.89-4.41 1.33-7.02 1.33-1.6 0-3.05-.27-4.33-.81-1.29-.54-2.23-1.23-2.83-2.09-.6-.85-1.02-2.01-1.25-3.46-.19-1.03-.28-3.12-.28-6.26V65.86h-4.08v-7.08h4.08v-6.67l8.92-5.19v11.86h6.07Zm6.26 33.59V46h6.14v40.9h22.84v5.47h-28.97Zm57.47-4.14c-2.11 1.79-4.14 3.06-6.09 3.8-1.95.74-4.04 1.11-6.28 1.11-3.69 0-6.53-.9-8.51-2.7-1.98-1.8-2.97-4.11-2.97-6.91 0-1.64.37-3.15 1.12-4.51s1.73-2.45 2.94-3.27c1.21-.82 2.58-1.44 4.1-1.87 1.12-.3 2.8-.58 5.06-.85 4.6-.55 7.98-1.2 10.15-1.96.02-.78.03-1.28.03-1.49 0-2.32-.54-3.95-1.61-4.9-1.46-1.29-3.62-1.93-6.48-1.93-2.68 0-4.65.47-5.93 1.41s-2.22 2.6-2.83 4.98l-5.57-.76c.51-2.38 1.34-4.31 2.5-5.77 1.16-1.47 2.84-2.59 5.03-3.38 2.19-.79 4.73-1.19 7.62-1.19s5.2.34 6.99 1.01c1.79.68 3.11 1.52 3.95 2.55.84 1.02 1.43 2.31 1.77 3.88.19.97.28 2.72.28 5.25v7.59c0 5.29.12 8.64.36 10.04.24 1.4.72 2.75 1.44 4.03h-5.95c-.59-1.18-.97-2.56-1.14-4.14Zm-.47-12.72c-2.07.84-5.17 1.56-9.3 2.15-2.34.34-4 .72-4.97 1.14-.97.42-1.72 1.04-2.25 1.85s-.79 1.71-.79 2.7c0 1.52.57 2.78 1.72 3.8 1.15 1.01 2.83 1.52 5.05 1.52s4.14-.48 5.85-1.44 2.96-2.27 3.76-3.94c.61-1.29.92-3.18.92-5.69v-2.09Zm14.33 29.8-.63-5.35c1.24.34 2.33.51 3.26.51 1.27 0 2.28-.21 3.04-.63s1.38-1.01 1.87-1.77c.36-.57.94-1.98 1.74-4.24.11-.32.27-.78.51-1.39l-12.75-33.65h6.14l6.99 19.45c.91 2.47 1.72 5.06 2.44 7.78.65-2.61 1.43-5.17 2.34-7.65l7.18-19.58h5.69l-12.78 34.16c-1.37 3.69-2.44 6.23-3.19 7.62-1.01 1.88-2.17 3.25-3.48 4.13-1.31.88-2.87 1.31-4.68 1.31-1.1 0-2.32-.23-3.67-.7Zm55.63-23.76 5.88.73c-.93 3.44-2.65 6.1-5.16 8-2.51 1.9-5.71 2.85-9.62 2.85-4.91 0-8.81-1.51-11.69-4.54-2.88-3.03-4.32-7.27-4.32-12.73s1.46-10.04 4.36-13.16c2.91-3.12 6.68-4.68 11.32-4.68s8.16 1.53 11.01 4.59c2.85 3.06 4.27 7.36 4.27 12.91 0 .34-.01.84-.03 1.52h-25.05c.21 3.69 1.25 6.52 3.13 8.48 1.88 1.96 4.22 2.94 7.02 2.94 2.09 0 3.87-.55 5.35-1.64 1.48-1.1 2.65-2.85 3.51-5.25Zm-18.69-9.2h18.76c-.25-2.83-.97-4.94-2.15-6.36-1.81-2.19-4.17-3.29-7.05-3.29-2.61 0-4.81.88-6.6 2.63s-2.77 4.09-2.96 7.02Zm31.66 20.02V58.78h5.12v5.09c1.31-2.38 2.51-3.95 3.62-4.71s2.32-1.14 3.65-1.14c1.92 0 3.87.61 5.85 1.83l-1.96 5.28c-1.39-.82-2.78-1.23-4.18-1.23-1.24 0-2.36.37-3.35 1.12-.99.75-1.7 1.79-2.12 3.12-.63 2.02-.95 4.24-.95 6.64v17.59h-5.69Zm21.79 0V46h9.36v46.37h-9.36ZM407.37 46h17.11c3.86 0 6.8.3 8.83.89 2.72.8 5.05 2.22 6.99 4.27 1.94 2.05 3.42 4.55 4.43 7.51 1.01 2.96 1.52 6.62 1.52 10.96 0 3.82-.47 7.11-1.42 9.87-1.16 3.37-2.82 6.1-4.97 8.19-1.62 1.58-3.82 2.82-6.58 3.7-2.07.65-4.83.98-8.29.98h-17.62V46Zm9.36 7.84v30.71h6.99c2.61 0 4.5-.15 5.66-.44 1.52-.38 2.78-1.02 3.78-1.93 1-.91 1.82-2.4 2.45-4.48.63-2.08.95-4.91.95-8.49s-.32-6.34-.95-8.26-1.52-3.42-2.66-4.49-2.58-1.8-4.33-2.18c-1.31-.3-3.87-.44-7.69-.44h-4.21Z" style="fill:#fff"/><text y="670" x="30" style="font:70px sans-serif;fill:#fff">',
                        platformName,
                        "</text></svg>"
                    )
                )
            )
        );
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                platformName,
                                '", "image":"',
                                image,
                                unicode'", "description": "Talent Layer Platform ID"}'
                            )
                        )
                    )
                )
            );
    }

    // =========================== Modifiers ==============================

    /**
     * Check if Platform is able to mint a new Platform ID.
     * @param _platformName name for the platform
     * @param _platformAddress address of the platform associated with the ID
     */
    modifier canMint(string memory _platformName, address _platformAddress) {
        require(msg.value == mintFee, "Incorrect amount of ETH for mint fee");
        require(numberMinted(_platformAddress) == 0, "Platform already has a Platform ID");
        require(bytes(_platformName).length >= 2, "Name too short");
        require(bytes(_platformName).length <= 10, "Name too long");
        require(!takenNames[_platformName], "Name already taken");
        _;
    }

    // =========================== Events ==============================

    /**
     * Emit when new Platform ID is minted.
     * @param _platformOwnerAddress Address of the owner of the PlatformID
     * @param _tokenId New Platform ID
     * @param _platformName Name of the platform
     * @param _fee Fee paid to mint the Platform ID
     */
    event Mint(address indexed _platformOwnerAddress, uint256 _tokenId, string _platformName, uint256 _fee);

    /**
     * Emit when Cid is updated for a platform.
     * @param _tokenId Platform ID concerned
     * @param _newCid New URI
     */
    event CidUpdated(uint256 indexed _tokenId, string _newCid);

    /**
     * Emit when mint fee is updated
     * @param _mintFee The new mint fee
     */
    event MintFeeUpdated(uint256 _mintFee);

    /**
     * Emit when the fee is updated for a platform
     * @param _platformFee The new fee
     */
    event PlatformFeeUpdated(uint256 _platformId, uint16 _platformFee);

    /**
     * Emit after the arbitrator is updated for a platform
     * @param _platformId The ID of the platform
     * @param _arbitrator The address of the new arbitrator
     * @param _extraData The new extra data for the arbitrator
     */
    event ArbitratorUpdated(uint256 _platformId, Arbitrator _arbitrator, bytes _extraData);

    /**
     * Emit after the arbitration fee timeout is updated for a platform
     * @param _platformId The ID of the platform
     * @param _arbitrationFeeTimeout The new arbitration fee timeout
     */
    event ArbitrationFeeTimeoutUpdated(uint256 _platformId, uint256 _arbitrationFeeTimeout);
}
