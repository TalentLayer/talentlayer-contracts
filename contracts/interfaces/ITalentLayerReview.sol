// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title TalentLayer Review Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerReview {
    struct Review {
        uint256 id;
        uint256 ownerId;
        string dataUri;
        uint256 serviceId;
        uint256 rating;
    }

    function getReview(uint256 _reviewId) external view returns (Review memory);

    function mint(
        uint256 _tokenId,
        uint256 _serviceId,
        string calldata _reviewUri,
        uint256 _rating
    ) external returns (uint256);
}
