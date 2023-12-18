// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerReview {
    // Struct declarations
    struct Review {
        uint256 id;
        uint256 ownerId;
        string dataUri;
        uint256 serviceId;
        uint256 rating;
    }

    // Function declarations
    // View Functions
    function getReview(uint256 _reviewId) external view returns (Review memory);

    function totalSupply() external view returns (uint256);

    // User Functions
    function mint(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating
    ) external returns (uint256);

    // Event declarations
    event Mint(
        uint256 indexed serviceId,
        uint256 indexed toId,
        uint256 indexed tokenId,
        uint256 rating,
        string reviewUri,
        uint256 proposalId
    );
}
