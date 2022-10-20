// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IJobRegistry {
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
    
    struct Job {
        Status status;
        uint256 buyerId;
        uint256 sellerId;
        uint256 initiatorId;
        string jobDataUri;
        uint256 countProposals;
        uint256 transactionId;
    }

    struct Proposal {
        ProposalStatus status;
        uint256 sellerId;
        address rateToken;
        uint256 rateAmount;
        string proposalDataUri;
    }


    function getJob(uint256 _jobId) external view returns (Job memory);

    function getProposal(uint256 _jobId, uint256 _proposal) external view returns (Proposal memory);

    function afterDeposit(uint256 _jobId, uint256 _proposalId, uint256 _transactionId) external;

    function afterFullPayment(uint256 _jobId) external;
}