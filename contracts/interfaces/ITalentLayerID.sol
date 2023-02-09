// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITalentLayerID {
    struct Profile {
        uint256 id;
        string handle;
        address pohAddress;
        uint256 platformId;
        string dataUri;
    }

    function numberMinted(address _user) external view returns (uint256);

    function isTokenPohRegistered(uint256 _tokenId) external view returns (bool);

    function walletOfOwner(address _owner) external view returns (uint256);

    function mint(string memory _handle) external;

    function mintWithPoh(string memory _handle) external;

    function activatePoh(uint256 _tokenId) external;

    function updateProfileData(uint256 _tokenId, string memory _newCid) external;

    function isValid(uint256 _tokenId) external view;

    function setBaseURI(string memory _newBaseURI) external;

    function getProfile(uint256 _profileId) external view returns (Profile memory);

    function _afterMint(string memory _handle) external;

    function ownerOf(uint256 _tokenId) external view returns (address);

    function getOriginatorPlatformIdByAddress(address _address) external view returns (uint256);

    function isDelegator(address _userAddress, address _address) external view returns (bool);

    function isOwnerOrDelegator(uint256 _tokenId, address _address) external view returns (bool);

    event Mint(address indexed _user, uint256 _tokenId, string _handle);
}
