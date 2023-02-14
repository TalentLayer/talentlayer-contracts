// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITalentLayerService {
    enum Status {
        Filled,
        Confirmed,
        Finished,
        Rejected,
        Opened
    }

    enum ProposalStatus {
        Pending,
        Validated,
        Rejected
    }

    struct Service {
        Status status;
        uint256 buyerId;
        uint256 sellerId;
        uint256 initiatorId;
        string serviceDataUri;
        uint256 countProposals;
        uint256 transactionId;
        uint256 platformId;
    }

    struct Proposal {
        ProposalStatus status;
        uint256 sellerId;
        address rateToken;
        uint256 rateAmount;
        uint16 platformId;
        string proposalDataUri;
    }

    function getService(uint256 _serviceId) external view returns (Service memory);

    function getProposal(uint256 _serviceId, uint256 _proposal) external view returns (Proposal memory);

    function createOpenServiceFromBuyer(
        uint256 _platformId,
        string calldata _serviceDataUri
    ) external returns (uint256);

    function createProposal(
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        uint16 _platformId,
        string calldata _proposalDataUri
    ) external;

    function afterDeposit(uint256 _serviceId, uint256 _proposalId, uint256 _transactionId) external;

    function updateProposal(
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        string calldata _proposalDataUri
    ) external;

    function validateProposal(uint256 _serviceId, uint256 _proposalId) external;

    function rejectProposal(uint256 _serviceId, uint256 _proposalId) external;

    function afterFullPayment(uint256 _serviceId) external;

    function updateServiceData(uint256 _serviceId, string calldata _newServiceDataUri) external;
}
