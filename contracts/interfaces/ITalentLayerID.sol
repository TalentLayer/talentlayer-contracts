// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerID {
    // Enum declarations
    enum MintStatus {
        ON_PAUSE,
        ONLY_WHITELIST,
        PUBLIC
    }

    // Struct declarations
    struct Profile {
        uint256 id;
        string handle;
        uint256 platformId;
        string dataUri;
    }

    // Function declarations
    // View functions
    function ownerOf(uint256 _tokenId) external view returns (address);

    function totalSupply() external view returns (uint256);

    function getOriginatorPlatformIdByAddress(address _address) external view returns (uint256);

    function isValid(uint256 _profileId) external view;

    function isDelegate(uint256 _profileId, address _address) external view returns (bool);

    function isOwnerOrDelegate(uint256 _profileId, address _address) external view returns (bool);

    function ownersOf(uint256 _tokenId1, uint256 _tokenId2) external view returns (address, address);

    function isWhitelisted(
        address _address,
        string memory _handle,
        bytes32[] memory _proof
    ) external view returns (bool);

    function getHandlePrice(string calldata _handle) external view returns (uint256);

    function tokenURI(uint256 tokenId) external view returns (string memory);

    // User functions
    function mint(uint256 _platformId, string calldata _handle) external payable returns (uint256);

    function mintForAddress(
        address _address,
        uint256 _platformId,
        string calldata _handle
    ) external payable returns (uint256);

    function whitelistMint(
        uint256 _platformId,
        string calldata _handle,
        bytes32[] calldata _proof
    ) external payable returns (uint256);

    function updateProfileData(uint256 _profileId, string memory _newCid) external;

    function addDelegate(uint256 _profileId, address _delegate) external;

    function removeDelegate(uint256 _profileId, address _delegate) external;

    function setHasActivity(uint256 _profileId) external;

    // Owner functions
    function updateMintFee(uint256 _mintFee) external;

    function withdraw() external;

    function freeMint(uint256 _platformId, address _userAddress, string calldata _handle) external returns (uint256);

    function setWhitelistMerkleRoot(bytes32 root) external;

    function updateMintStatus(MintStatus _mintStatus) external;

    function updateShortHandlesMaxPrice(uint256 _shortHandlesMaxPrice) external;

    function setIsServiceContract(address _address, bool _isServiceContract) external;

    // Event declarations
    event Mint(address indexed user, uint256 profileId, string handle, uint256 platformId, uint256 fee);
    event CidUpdated(uint256 indexed profileId, string newCid);
    event MintFeeUpdated(uint256 mintFee);
    event DelegateAdded(uint256 profileId, address delegate);
    event DelegateRemoved(uint256 profileId, address delegate);
    event MintStatusUpdated(MintStatus mintStatus);
    event ShortHandlesMaxPriceUpdated(uint256 price);

    // Error declarations
    error HandleLengthInvalid();
    error HandleContainsInvalidCharacters();
    error HandleFirstCharInvalid();
}
