// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team
 */
interface ITalentLayerReview {
    // Struct Review
    struct Review {
        uint256 id;
        uint256 owner;
        string dataUri;
        uint256 platformId;
        uint256 serviceId;
        uint256 rating;
    }

    error ReviewAlreadyMinted();

    function getReview(uint256 _reviewId) external view virtual returns (Review memory);

    function addReview(
        uint256 _tokenId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating,
        uint256 _platformId
    ) external virtual;
}
