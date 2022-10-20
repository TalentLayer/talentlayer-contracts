// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title JobRegistry Contract
 * @author TalentLayer Team @ ETHCC22 Hackathon
 */
contract JobRegistry is AccessControl {
    // =========================== Enum ==============================

    /// @notice Enum job status
    enum Status {
        Filled,
        Confirmed,
        Finished,
        Rejected,
        Opened
    }

    /// @notice Enum job status
    enum ProposalStatus {
        Pending,
        Validated,
        Rejected
    }

    // =========================== Struct ==============================

    /// @notice Job information struct
    /// @param status the current status of a job
    /// @param buyerId the talentLayerId of the buyer
    /// @param sellerId the talentLayerId of the seller
    /// @param initiatorId the talentLayerId of the user who initialized the job
    /// @param jobDataUri token Id to IPFS URI mapping
    /// @param proposals all proposals for this job
    /// @param countProposals the total number of proposal for this job
    /// @param transactionId the escrow transaction ID linked to the job
    /// @param platformId the platform ID linked to the job
    struct Job {
        Status status;
        uint256 buyerId;
        uint256 sellerId;
        uint256 initiatorId;
        string jobDataUri;
        uint256 countProposals;
        uint256 transactionId;
        uint256 platformId;
    }

    /// @notice Proposal information struct
    /// @param status the current status of a job
    /// @param sellerId the talentLayerId of the seller
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    /// @param proposalDataUri token Id to IPFS URI mapping
    struct Proposal {
        ProposalStatus status;
        uint256 sellerId;
        address rateToken;
        uint256 rateAmount;
        string proposalDataUri;
    }

    // =========================== Events ==============================

    /// @notice Emitted after a new job is created
    /// @param id The job ID (incremental)
    /// @param buyerId the talentLayerId of the buyer
    /// @param sellerId the talentLayerId of the seller
    /// @param initiatorId the talentLayerId of the user who initialized the job
    /// @param platformId platform ID on which the Job token was minted
    /// @dev Events "JobCreated" & "JobDataCreated" are split to avoid "stack too deep" error
    event JobCreated(
        uint256 id,
        uint256 buyerId,
        uint256 sellerId,
        uint256 initiatorId,
        uint256 platformId
    );

    /// @notice Emitted after a new job is created
    /// @param id The job ID (incremental)
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobDataCreated(
        uint256 id,
        string jobDataUri
    );

    /// @notice Emitted after an seller is assigned to a job
    /// @param id The job ID
    /// @param sellerId the talentLayerId of the seller
    /// @param status job status
    event JobSellerAssigned(uint256 id, uint256 sellerId, Status status);

    /// @notice Emitted after a job is confirmed
    /// @param id The job ID
    /// @param buyerId the talentLayerId of the buyer
    /// @param sellerId the talentLayerId of the seller
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobConfirmed(
        uint256 id,
        uint256 buyerId,
        uint256 sellerId,
        string jobDataUri
    );

    /// @notice Emitted after a job is rejected
    /// @param id The job ID
    /// @param buyerId the talentLayerId of the buyer
    /// @param sellerId the talentLayerId of the seller
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobRejected(
        uint256 id,
        uint256 buyerId,
        uint256 sellerId,
        string jobDataUri
    );

    /// @notice Emitted after a job is finished
    /// @param id The job ID
    /// @param buyerId the talentLayerId of the buyer
    /// @param sellerId the talentLayerId of the seller
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobFinished(
        uint256 id,
        uint256 buyerId,
        uint256 sellerId,
        string jobDataUri
    );

    /// @notice Emitted after a new proposal is created
    /// @param jobId The job id
    /// @param sellerId The talentLayerId of the seller who made the proposal
    /// @param proposalDataUri token Id to IPFS URI mapping
    /// @param status proposal status
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    event ProposalCreated(
        uint256 jobId,
        uint256 sellerId,
        string proposalDataUri,
        ProposalStatus status,
        address rateToken,
        uint256 rateAmount
    );

    /// @notice Emitted after an existing proposal has been updated
    /// @param jobId The job id
    /// @param sellerId The talentLayerId of the seller who made the proposal
    /// @param proposalDataUri token Id to IPFS URI mapping
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    event ProposalUpdated(
        uint256 jobId,
        uint256 sellerId,
        string proposalDataUri,
        address rateToken,
        uint256 rateAmount
    );

    /// @notice Emitted after a proposal is validated
    /// @param jobId The job ID
    /// @param sellerId the talentLayerId of the seller
    event ProposalValidated(uint256 jobId, uint256 sellerId);

    /// @notice Emitted after a proposal is rejected
    /// @param jobId The job ID
    /// @param sellerId the talentLayerId of the seller
    event ProposalRejected(uint256 jobId, uint256 sellerId);

    /// @notice incremental job Id
    uint256 public nextJobId = 1;

    /// @notice TalentLayerId address
    ITalentLayerID private tlId;

    /// TalentLayer Platform ID registry
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    /// @notice jobs mappings index by ID
    mapping(uint256 => Job) public jobs;

    /// @notice proposals mappings index by job ID and seller TID
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals;

    // @notice
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    /**
     * @param _talentLayerIdAddress TalentLayerId address
     */
    constructor(address _talentLayerIdAddress, address _talentLayerPlatformIdAddress) {
        tlId = ITalentLayerID(_talentLayerIdAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =========================== View functions ==============================

    /**
     * @notice Return the whole job data information
     * @param _jobId Job identifier
     */
    function getJob(uint256 _jobId) external view returns (Job memory) {
        require(_jobId < nextJobId, "This job doesn't exist");
        return jobs[_jobId];
    }

    function getProposal(uint256 _jobId, uint256 _proposalId)
        external
        view
        returns (Proposal memory)
    {
        return proposals[_jobId][_proposalId];
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows an buyer to initiate a new Job with an seller
     * @param _platformId platform ID on which the Job token was minted
     * @param _sellerId Handle for the user
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createJobFromBuyer(
        uint256 _platformId,
        uint256 _sellerId,
        string calldata _jobDataUri
    ) public returns (uint256) {
        require(_sellerId > 0, "Seller 0 is not a valid TalentLayerId");
        talentLayerPlatformIdContract.isValid(_platformId);
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return
        _createJob(
            Status.Filled,
            senderId,
            senderId,
            _sellerId,
            _jobDataUri,
            _platformId
        );
    }

    /**
     * @notice Allows an seller to initiate a new Job with an buyer
     * @param _platformId platform ID on which the Job token was minted
     * @param _buyerId Handle for the user
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createJobFromSeller(
        uint256 _platformId,
        uint256 _buyerId,
        string calldata _jobDataUri
    ) public returns (uint256) {
        require(_buyerId > 0, "Buyer 0 is not a valid TalentLayerId");
        talentLayerPlatformIdContract.isValid(_platformId);
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return
        _createJob(
            Status.Filled,
            senderId,
            _buyerId,
            senderId,
            _jobDataUri,
            _platformId
        );
    }

    /**
     * @notice Allows an buyer to initiate an open job
     * @param _platformId platform ID on which the Job token was minted
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createOpenJobFromBuyer(
        uint256 _platformId,
        string calldata _jobDataUri
    ) public returns (uint256) {
        talentLayerPlatformIdContract.isValid(_platformId);
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return
        _createJob(
            Status.Opened,
            senderId,
            senderId,
            0,
            _jobDataUri,
            _platformId
        );
    }

    /**
     * @notice Allows an seller to propose his service for a job
     * @param _jobId The job linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token choosed
     * @param _proposalDataUri token Id to IPFS URI mapping
     */
    function createProposal(
        uint256 _jobId,
        address _rateToken,
        uint256 _rateAmount,
        string calldata _proposalDataUri
    ) public {
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(senderId > 0, "You sould have a TalentLayerId");

        Job storage job = jobs[_jobId];
        require(job.status == Status.Opened, "Job is not opened");
        require(
            proposals[_jobId][senderId].sellerId != senderId,
            "You already created a proposal for this job"
        );
        require(job.countProposals < 40, "Max proposals count reached");
        require(
            job.buyerId != senderId,
            "You couldn't create proposal for your own job"
        );
        require(
            bytes(_proposalDataUri).length > 0,
            "Should provide a valid IPFS URI"
        );

        job.countProposals++;
        proposals[_jobId][senderId] = Proposal({
            status: ProposalStatus.Pending,
            sellerId: senderId,
            rateToken: _rateToken,
            rateAmount: _rateAmount,
            proposalDataUri: _proposalDataUri
        });

        emit ProposalCreated(
            _jobId,
            senderId,
            _proposalDataUri,
            ProposalStatus.Pending,
            _rateToken,
            _rateAmount
        );
    }

    /**
     * @notice Allows an seller to update his own proposal for a given job
     * @param _jobId The job linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token choosed
     * @param _proposalDataUri token Id to IPFS URI mapping
     */
    function updateProposal(
        uint256 _jobId,
        address _rateToken,
        uint256 _rateAmount,
        string calldata _proposalDataUri
    ) public {
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(senderId > 0, "You sould have a TalentLayerId");

        Job storage job = jobs[_jobId];
        Proposal storage proposal = proposals[_jobId][senderId];
        require(job.status == Status.Opened, "Job is not opened");
        require(
            proposal.sellerId == senderId,
            "This proposal doesn't exist yet"
        );
        require(
            bytes(_proposalDataUri).length > 0,
            "Should provide a valid IPFS URI"
        );
        require(
            proposal.status != ProposalStatus.Validated,
            "This proposal is already updated"
        );

        proposal.rateToken = _rateToken;
        proposal.rateAmount = _rateAmount;
        proposal.proposalDataUri = _proposalDataUri;

        emit ProposalUpdated(
            _jobId,
            senderId,
            _proposalDataUri,
            _rateToken,
            _rateAmount
        );
    }

    /**
     * @notice Allows the buyer to validate a proposal
     * @param _jobId Job identifier
     * @param _proposalId Proposal identifier
     */
    function validateProposal(uint256 _jobId, uint256 _proposalId) public {
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(senderId > 0, "You sould have a TalentLayerId");

        Job storage job = jobs[_jobId];
        Proposal storage proposal = proposals[_jobId][_proposalId];

        require(
            proposal.status != ProposalStatus.Validated,
            "Proposal has already been validated"
        );
        require(senderId == job.buyerId, "You're not the buyer");

        proposal.status = ProposalStatus.Validated;

        emit ProposalValidated(_jobId, _proposalId);
    }

    /**
     * @notice Allows the buyer to reject a proposal
     * @param _jobId Job identifier
     * @param _proposalId Proposal identifier
     */
    function rejectProposal(uint256 _jobId, uint256 _proposalId) public {
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(senderId > 0, "You sould have a TalentLayerId");

        Job storage job = jobs[_jobId];
        Proposal storage proposal = proposals[_jobId][_proposalId];

        require(
            proposal.status != ProposalStatus.Validated,
            "Proposal has already been validated"
        );

        require(
            proposal.status != ProposalStatus.Rejected,
            "Proposal has already been rejected"
        );

        require(senderId == job.buyerId, "You're not the buyer");

        proposal.status = ProposalStatus.Rejected;

        emit ProposalRejected(_jobId, _proposalId);
    }

    /**
     * @notice Allows the user who didn't initiate the job to confirm it. They now consent both to be reviewed each other at the end of job.
     * @param _jobId Job identifier
     */
    function confirmJob(uint256 _jobId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);

        require(job.status == Status.Filled, "Job has already been confirmed");
        require(
            senderId == job.buyerId || senderId == job.sellerId,
            "You're not an actor of this job"
        );
        require(
            senderId != job.initiatorId,
            "Only the user who didn't initate the job can confirm it"
        );

        job.status = Status.Confirmed;

        emit JobConfirmed(
            _jobId,
            job.buyerId,
            job.sellerId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allow the escrow contract to upgrade the Job state after a deposit has been done
     * @param _jobId Job identifier
     * @param _proposalId The choosed proposal id for this job
     * @param _transactionId The escrow transaction Id
     */
    function afterDeposit(
        uint256 _jobId,
        uint256 _proposalId,
        uint256 _transactionId
    ) external onlyRole(ESCROW_ROLE) {
        Job storage job = jobs[_jobId];
        Proposal storage proposal = proposals[_jobId][_proposalId];

        job.status = Status.Confirmed;
        job.sellerId = proposal.sellerId;
        job.transactionId = _transactionId;
        proposal.status = ProposalStatus.Validated;
    }

    /**
     * @notice Allow the escrow contract to upgrade the Job state after the full payment has been received by the seller
     * @param _jobId Job identifier
     */
    function afterFullPayment(uint256 _jobId) external onlyRole(ESCROW_ROLE) {
        Job storage job = jobs[_jobId];
        job.status = Status.Finished;
    }

    /**
     * @notice Allows the user who didn't initiate the job to reject it
     * @param _jobId Job identifier
     */
    function rejectJob(uint256 _jobId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(
            senderId == job.buyerId || senderId == job.sellerId,
            "You're not an actor of this job"
        );
        require(
            job.status == Status.Filled || job.status == Status.Opened,
            "You can't reject this job"
        );
        job.status = Status.Rejected;

        emit JobRejected(
            _jobId,
            job.buyerId,
            job.sellerId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allows any part of a job to update his state to finished
     * @param _jobId Job identifier
     */
    function finishJob(uint256 _jobId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(
            senderId == job.buyerId || senderId == job.sellerId,
            "You're not an actor of this job"
        );
        require(job.status == Status.Confirmed, "You can't finish this job");
        job.status = Status.Finished;

        emit JobFinished(
            _jobId,
            job.buyerId,
            job.sellerId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allows the buyer to assign an seller to the job
     * @param _jobId Job identifier
     * @param _sellerId Handle for the user
     */
    function assignSellerToJob(uint256 _jobId, uint256 _sellerId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);

        require(
            job.status == Status.Opened || job.status == Status.Rejected,
            "Job has to be Opened or Rejected"
        );

        require(
            senderId == job.buyerId,
            "You're not an buyer of this job"
        );

        require(
            _sellerId != job.buyerId,
            "Seller and buyer can't be the same"
        );

        job.sellerId = _sellerId;
        job.status = Status.Filled;

        emit JobSellerAssigned(_jobId, _sellerId, job.status);
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update handle address mapping and emit event after mint.
     * @param _senderId the talentLayerId of the msg.sender address
     * @param _buyerId the talentLayerId of the buyer
     * @param _sellerId the talentLayerId of the seller
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function _createJob(
        Status _status,
        uint256 _senderId,
        uint256 _buyerId,
        uint256 _sellerId,
        string calldata _jobDataUri,
        uint256 _platformId
    ) private returns (uint256) {
        require(
            _sellerId != _buyerId,
            "Seller and buyer can't be the same"
        );
        require(_senderId > 0, "You sould have a TalentLayerId");
        require(
            bytes(_jobDataUri).length > 0,
            "Should provide a valid IPFS URI"
        );

        uint256 id = nextJobId;
        nextJobId++;

        Job storage job = jobs[id];
        job.status = _status;
        job.buyerId = _buyerId;
        job.sellerId = _sellerId;
        job.initiatorId = _senderId;
        job.jobDataUri = _jobDataUri;
        job.platformId = _platformId;

        emit JobCreated(
            id,
            _buyerId,
            _sellerId,
            _senderId,
            _platformId
        );

        emit JobDataCreated(
            id,
            _jobDataUri
        );

        return id;
    }
}
