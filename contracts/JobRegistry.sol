// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
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
    /// @param employerId the talentLayerId of the employer
    /// @param employeeId the talentLayerId of the employee
    /// @param initiatorId the talentLayerId of the user who initialized the job
    /// @param jobDataUri token Id to IPFS URI mapping
    /// @param proposals all proposals for this job
    /// @param countProposals the total number of proposal for this job
    /// @param transactionId the escrow transaction ID linked to the job
    struct Job {
        Status status;
        uint256 employerId;
        uint256 employeeId;
        uint256 initiatorId;
        string jobDataUri;
        uint256 countProposals;
        uint256 transactionId;
    }

    /// @notice Proposal information struct
    /// @param status the current status of a job
    /// @param employeeId the talentLayerId of the employee
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    /// @param proposalDataUri token Id to IPFS URI mapping
    struct Proposal {
        ProposalStatus status;
        uint256 employeeId;
        address rateToken;
        uint256 rateAmount;
        string proposalDataUri;
    }

    // =========================== Events ==============================

    /// @notice Emitted after a new job is created
    /// @param id The job ID (incremental)
    /// @param employerId the talentLayerId of the employer
    /// @param employeeId the talentLayerId of the employee
    /// @param initiatorId the talentLayerId of the user who initialized the job
    /// @param jobDataUri token Id to IPFS URI mapping
    /// @param status job status
    event JobCreated(
        uint256 id,
        uint256 employerId,
        uint256 employeeId,
        uint256 initiatorId,
        string jobDataUri,
        Status status
    );

    /// @notice Emitted after a new job is created
    /// @param id The job ID
    /// @param employeeId the talentLayerId of the employee
    /// @param status job status
    event JobEmployeeAssigned(uint256 id, uint256 employeeId, Status status);

    /// @notice Emitted after a job is confirmed
    /// @param id The job ID
    /// @param employerId the talentLayerId of the employer
    /// @param employeeId the talentLayerId of the employee
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobConfirmed(
        uint256 id,
        uint256 employerId,
        uint256 employeeId,
        string jobDataUri
    );

    /// @notice Emitted after a job is rejected
    /// @param id The job ID
    /// @param employerId the talentLayerId of the employer
    /// @param employeeId the talentLayerId of the employee
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobRejected(
        uint256 id,
        uint256 employerId,
        uint256 employeeId,
        string jobDataUri
    );

    /// @notice Emitted after a job is finished
    /// @param id The job ID
    /// @param employerId the talentLayerId of the employer
    /// @param employeeId the talentLayerId of the employee
    /// @param jobDataUri token Id to IPFS URI mapping
    event JobFinished(
        uint256 id,
        uint256 employerId,
        uint256 employeeId,
        string jobDataUri
    );

    /// @notice Emitted after a new proposal is created
    /// @param jobId The job id
    /// @param employeeId The talentLayerId of the employee who made the proposal
    /// @param proposalDataUri token Id to IPFS URI mapping
    /// @param status proposal status
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    event ProposalCreated(
        uint256 jobId,
        uint256 employeeId,
        string proposalDataUri,
        ProposalStatus status,
        address rateToken,
        uint256 rateAmount
    );

    /// @notice Emitted after an existing proposal has been update
    /// @param jobId The job id
    /// @param employeeId The talentLayerId of the employee who made the proposal
    /// @param proposalDataUri token Id to IPFS URI mapping
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token choosed
    event ProposalUpdated(
        uint256 jobId,
        uint256 employeeId,
        string proposalDataUri,
        address rateToken,
        uint256 rateAmount
    );

    /// @notice Emitted after a proposal is validated
    /// @param jobId The job ID
    /// @param employeeId the talentLayerId of the employee
    event ProposalValidated(uint256 jobId, uint256 employeeId);

    /// @notice Emitted after a proposal is rejected
    /// @param jobId The job ID
    /// @param employeeId the talentLayerId of the employee
    event ProposalRejected(uint256 jobId, uint256 employeeId);

    /// @notice Emitted after a job is finished
    /// @param id The job ID
    /// @param proposalId the proposal ID
    /// @param employeeId the talentLayerId of the employee
    /// @param transactionId the escrow transaction ID
    event JobProposalConfirmedWithDeposit(
        uint256 id,
        uint256 proposalId,
        uint256 employeeId,
        uint256 transactionId
    );

    /// @notice incremental job Id
    uint256 public nextJobId = 1;

    /// @notice TalentLayerId address
    ITalentLayerID private tlId;

    /// @notice jobs mappings index by ID
    mapping(uint256 => Job) public jobs;

    /// @notice proposals mappings index by job ID and employee TID
    mapping(uint256 => mapping (uint256 => Proposal)) public proposals;

    // @notice
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    /**
     * @param _talentLayerIdAddress TalentLayerId address
     */
    constructor(address _talentLayerIdAddress) {
        tlId = ITalentLayerID(_talentLayerIdAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =========================== View functions ==============================

    /**
     * @notice Return the whole job data information
     * @param _jobId Job identifier
     */
    function getJob(uint256 _jobId) external view returns (Job memory) {
        require(_jobId < nextJobId, "This job does'nt exist");
        return jobs[_jobId];
    }

    function getProposal(uint256 _jobId, uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_jobId][_proposalId];
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows an employer to initiate a new Job with an employee
     * @param _employeeId Handle for the user
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createJobFromEmployer(
        uint256 _employeeId,
        string calldata _jobDataUri
    ) public returns (uint256) {
        require(_employeeId > 0, "Employee 0 is not a valid TalentLayerId");
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return
            _createJob(
                Status.Filled,
                senderId,
                senderId,
                _employeeId,
                _jobDataUri
            );
    }

    /**
     * @notice Allows an employee to initiate a new Job with an employer
     * @param _employerId Handle for the user
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createJobFromEmployee(
        uint256 _employerId,
        string calldata _jobDataUri
    ) public returns (uint256) {
        require(_employerId > 0, "Employer 0 is not a valid TalentLayerId");
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return
            _createJob(
                Status.Filled,
                senderId,
                _employerId,
                senderId,
                _jobDataUri
            );
    }

    /**
     * @notice Allows an employer to initiate an open job
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function createOpenJobFromEmployer(string calldata _jobDataUri)
        public
        returns (uint256)
    {
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        return _createJob(Status.Opened, senderId, senderId, 0, _jobDataUri);
    }

    /**
     * @notice Allows an employee to propose his service for a job
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
            proposals[_jobId][senderId].employeeId != senderId,
            "You already created a proposal for this job"
        );
        require(job.countProposals < 40, "Max proposals count reached");
        require(
            job.employerId != senderId,
            "You couldn't create proposal for your own job"
        );
        require(
            bytes(_proposalDataUri).length > 0,
            "Should provide a valid IPFS URI"
        );

        job.countProposals++;
        proposals[_jobId][senderId] = Proposal({
            status: ProposalStatus.Pending,
            employeeId: senderId,
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
     * @notice Allows an employee to update his own proposal for a given job
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
            proposal.employeeId == senderId,
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
     * @notice Allows the employer to validate a proposal
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
        require(senderId == job.employerId, "You're not the employer");

        proposal.status = ProposalStatus.Validated;

        emit ProposalValidated(_jobId, senderId);
    }

    /**
     * @notice Allows the employer to reject a proposal
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
        require(senderId == job.employerId, "You're not the employer");

        proposal.status = ProposalStatus.Rejected;

        emit ProposalRejected(_jobId, senderId);
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
            senderId == job.employerId || senderId == job.employeeId,
            "You're not an actor of this job"
        );
        require(
            senderId != job.initiatorId,
            "Only the user who didn't initate the job can confirm it"
        );

        job.status = Status.Confirmed;

        emit JobConfirmed(
            _jobId,
            job.employerId,
            job.employeeId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allow the escrow contract to upgrade the Job state after a deposit has been done
     * @param _jobId Job identifier
     * @param _proposalId The choosed proposal id for this job
     * @param _transactionId The escrow transaction Id
     */
    function afterDeposit(uint256 _jobId, uint256 _proposalId, uint256 _transactionId) external onlyRole(ESCROW_ROLE) {
        Job storage job = jobs[_jobId];
        Proposal storage proposal = proposals[_jobId][_proposalId];
         
        job.status = Status.Confirmed;
        job.employeeId = proposal.employeeId;
        job.transactionId = _transactionId;
        proposal.status = ProposalStatus.Validated;

        emit JobProposalConfirmedWithDeposit(
            _jobId,
            _proposalId,
            job.employeeId,
            job.transactionId
        );
    }

    /**
     * @notice Allow the escrow contract to upgrade the Job state after the full payment has been received by the employee
     * @param _jobId Job identifier
     */
    function afterFullPayment(uint256 _jobId) external onlyRole(ESCROW_ROLE) {
        Job storage job = jobs[_jobId];
        job.status = Status.Finished;

        emit JobFinished(
            _jobId,
            job.employerId,
            job.employeeId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allows the user who didn't initiate the job to reject it
     * @param _jobId Job identifier
     */
    function rejectJob(uint256 _jobId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);
        require(
            senderId == job.employerId || senderId == job.employeeId,
            "You're not an actor of this job"
        );
        require(
            job.status == Status.Filled || job.status == Status.Opened,
            "You can't reject this job"
        );
        job.status = Status.Rejected;

        emit JobRejected(
            _jobId,
            job.employerId,
            job.employeeId,
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
            senderId == job.employerId || senderId == job.employeeId,
            "You're not an actor of this job"
        );
        require(job.status == Status.Confirmed, "You can't finish this job");
        job.status = Status.Finished;

        emit JobFinished(
            _jobId,
            job.employerId,
            job.employeeId,
            job.jobDataUri
        );
    }

    /**
     * @notice Allows the employer to assign an employee to the job
     * @param _jobId Job identifier
     * @param _employeeId Handle for the user
     */
    function assignEmployeeToJob(uint256 _jobId, uint256 _employeeId) public {
        Job storage job = jobs[_jobId];
        uint256 senderId = tlId.walletOfOwner(msg.sender);

        require(
            job.status == Status.Opened || job.status == Status.Rejected,
            "Job has to be Opened or Rejected"
        );

        require(
            senderId == job.employerId,
            "You're not an employer of this job"
        );

        require(
            _employeeId != job.employerId,
            "Employee and employer can't be the same"
        );

        job.employeeId = _employeeId;
        job.status = Status.Filled;

        emit JobEmployeeAssigned(_jobId, _employeeId, job.status);
    }

    // =========================== Private functions ==============================

    /**
     * @notice Update handle address mapping and emit event after mint.
     * @param _senderId the talentLayerId of the msg.sender address
     * @param _employerId the talentLayerId of the employer
     * @param _employeeId the talentLayerId of the employee
     * @param _jobDataUri token Id to IPFS URI mapping
     */
    function _createJob(
        Status _status,
        uint256 _senderId,
        uint256 _employerId,
        uint256 _employeeId,
        string calldata _jobDataUri
    ) private returns (uint256) {
        require(
            _employeeId != _employerId,
            "Employee and employer can't be the same"
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
        job.employerId = _employerId;
        job.employeeId = _employeeId;
        job.initiatorId = _senderId;
        job.jobDataUri = _jobDataUri;

        emit JobCreated(
            id,
            _employerId,
            _employeeId,
            _senderId,
            _jobDataUri,
            _status
        );

        return id;
    }
}
