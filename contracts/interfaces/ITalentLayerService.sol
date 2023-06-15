// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerService {
    enum Status {
        Opened,
        Confirmed,
        Finished,
        Cancelled,
        Uncompleted
    }

    enum ProposalStatus {
        Pending,
        Validated
    }

    struct Service {
        Status status;
        uint256 ownerId;
        uint256 acceptedProposalId;
        string dataUri;
        uint256 transactionId;
        uint256 platformId;
        address rateToken;
        uint256 referralAmount;
    }

    struct Proposal {
        ProposalStatus status;
        uint256 ownerId;
        address rateToken;
        uint256 rateAmount;
        uint256 platformId;
        string dataUri;
        uint256 expirationDate;
        uint256 referrerId;
    }

    function getService(uint256 _serviceId) external view returns (Service memory);

    function getProposal(uint256 _serviceId, uint256 _proposal) external view returns (Proposal memory);

    function getServiceAndProposal(
        uint256 _serviceId,
        uint256 _proposal
    ) external view returns (Service memory, Proposal memory);

    function createService(
        uint256 _profileId,
        uint256 _platformId,
        string calldata _dataUri,
        bytes calldata _signature,
        address _rateToken,
        uint256 _referralAmount
    ) external returns (uint256);

    function createProposal(
        uint256 _profileId,
        uint256 _serviceId,
        uint256 _rateAmount,
        uint256 _platformId,
        string calldata _dataUri,
        uint256 _expirationDate,
        bytes calldata _signature,
        uint256 _referrerId
    ) external;

    function afterDeposit(uint256 _serviceId, uint256 _proposalId, uint256 _transactionId) external;

    function updateProposal(
        uint256 _profileId,
        uint256 _serviceId,
        uint256 _rateAmount,
        string calldata _dataUri,
        uint256 _expirationDate,
        uint256 _referrerId
    ) external;

    function afterFullPayment(uint256 _serviceId, uint256 _releasedAmount) external;

    function updateService(
        uint256 _profileId,
        uint256 _serviceId,
        uint256 _referralAmount,
        string calldata _dataUri
    ) external;
}
