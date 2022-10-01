// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "hardhat/console.sol";

import "../interfaces/IJobRegistry.sol";
import "../interfaces/ITalentLayerID.sol";
import "./IArbitrable.sol";
import "./Arbitrator.sol";

contract TalentLayerMultipleArbitrableTransaction {

    // =========================== Enum ==============================

    // =========================== Struct ==============================

    struct Transaction {
        address sender; //pays recipient using the escrow
        address receiver; //intended recipient of the escrow
        address token; //token of the escrow
        uint256 amount; //amount locked into escrow
        uint256 jobId; //the jobId related to the transaction
    }

    // =========================== Events ==============================
    
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

    /// @notice Emitted after a job is finished
    /// @param _jobId The job ID
    event PaymentCompleted(uint256 _jobId);

    // =========================== Declarations ==============================
    
    Transaction[] private transactions; //transactions stored in array with index = id
    address private jobRegistryAddress; //contract address to JobRegistry.sol
    address private talentLayerIDAddress; //contract address to TalentLayerID.sol

    // =========================== Constructor ==============================

    /** @dev Called on contract deployment
     *  @param _jobRegistryAddress Contract address to JobRegistry.sol
     *  @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _feeTimeout Arbitration fee timeout for the parties.
     */
    constructor(
        address _jobRegistryAddress,
        address _talentLayerIDAddress,
        Arbitrator _arbitrator, 
        bytes memory _arbitratorExtraData,
        uint _feeTimeout
    ) {
        _setJobRegistryAddress(_jobRegistryAddress);
        _setTalentLayerIDAddress(_talentLayerIDAddress);
        // arbitrator = _arbitrator;
        // arbitratorExtraData = _arbitratorExtraData;
        // feeTimeout = _feeTimeout;
    }

    // =========================== View functions ==============================

    

    // =========================== User functions ==============================
    
    /*  @dev Validates a proposal for a job by locking ETH into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _adminWallet Admin fee wallet.
     *  @param _adminFeeAmount Admin fee amount.
     *  @param _jobId Job of transaction
     *  @param _jobId Id of the job that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates. 
     */
    function createETHTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        address _adminWallet,
        uint256 _adminFeeAmount,
        uint256 _jobId,
        uint256 _proposalId
    ) external payable {
        IJobRegistry.Proposal memory proposal;
        IJobRegistry.Job memory job;
        address sender;
        address receiver;

        (proposal, job, sender, receiver) = _getTalentLayerData(_jobId, _proposalId);

        require(msg.sender == sender, "Access denied.");
        require(msg.value == proposal.rateAmount + _adminFeeAmount, "Non-matching funds.");
        require(proposal.rateToken == address(0), "Proposal token not ETH.");

        require(job.status == IJobRegistry.Status.Opened, "Job status not open.");
        require(proposal.status == IJobRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, proposal.rateAmount, _jobId);
        IJobRegistry(jobRegistryAddress).afterDeposit(_jobId, _proposalId, transactionId); 

        emit JobProposalConfirmedWithDeposit(
            _jobId,
            _proposalId,
            _proposalId,
            transactionId
        );
    }

    /*  @dev Validates a proposal for a job by locking ERC20 into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _adminWallet Admin fee wallet.
     *  @param _adminFeeAmount Admin fee amount.
     *  @param _jobId Id of the job that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates. 
     */
    function createTokenTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        address _adminWallet,
        uint256 _adminFeeAmount,
        uint256 _jobId,
        uint256 _proposalId
    ) external {
        IJobRegistry.Proposal memory proposal;
        IJobRegistry.Job memory job;
        address sender;
        address receiver;

        (proposal, job, sender, receiver) = _getTalentLayerData(_jobId, _proposalId);

        require(job.status == IJobRegistry.Status.Opened, "Job status not open.");
        require(proposal.status == IJobRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, proposal.rateAmount, _jobId);
        IJobRegistry(jobRegistryAddress).afterDeposit(_jobId, _proposalId, transactionId); 
        _deposit(sender, proposal.rateToken, proposal.rateAmount); 

        emit JobProposalConfirmedWithDeposit(
            _jobId,
            _proposalId,
            _proposalId,
            transactionId
        );
    }

    /*  @dev Allows the sender to release locked-in escrow value to the intended recipient.
     *  @param _transactionId Id of the transaction to release escrow value for.
     *  @param _amount Value to be released. Should not be more than amount locked in.
     */
    function release(
        uint256 _transactionId,
        uint256 _amount
    ) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.sender == msg.sender, "Access denied.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _release(transaction.receiver, transaction.token, _amount);
        _distributeMessage(transaction.jobId, transaction.amount);
    }

    /*  @dev Allows the intended receiver to return locked-in escrow value back to the sender.
     *  @param _transactionId Id of the transaction to reimburse escrow value for.
     *  @param _amount Value to be reimbursed. Should not be more than amount locked in.
     */
    function reimburse(
        uint256 _transactionId,
        uint256 _amount
    ) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.receiver == msg.sender, "Access denied.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _release(transaction.sender, transaction.token, _amount);
        _distributeMessage(transaction.jobId, transaction.amount);
    }

    // =========================== Private functions ==============================

    
    function _setJobRegistryAddress(
        address _jobRegistryAddress
    ) private {
        jobRegistryAddress = _jobRegistryAddress;
    }

    function _setTalentLayerIDAddress(
        address _talentLayerIDAddress
    ) private {
        talentLayerIDAddress = _talentLayerIDAddress;
    }
    
    function _saveTransaction(
        address _sender, 
        address _receiver,
        address _token,
        uint256 _amount,
        uint256 _jobId
    ) private returns (uint256){
        transactions.push(
            Transaction({
                sender: _sender,
                receiver: _receiver,
                token: _token,
                amount: _amount,
                jobId: _jobId
            })
        );
        return transactions.length -1;
    }
    
    function _deposit(
        address _sender, 
        address _token,
        uint256 _amount
    ) private {
        require(
            IERC20(_token).transferFrom(_sender, address(this), _amount), 
            "Transfer must not fail"
        );
    }

    function _release(
        address _receiver,
        address _token,
        uint256 _amount
    ) private {
        if(_token == address(0)){
            payable(_receiver).transfer(_amount);
        } else {
            require(
                IERC20(_token).transfer(_receiver, _amount), 
                "Transfer must not fail"
            );
        }
    }

    function _distributeMessage(
        uint256 _jobId, 
        uint256 _amount
    ) private {
        if (_amount == 0) {
            IJobRegistry(jobRegistryAddress).afterFullPayment(_jobId);
            emit PaymentCompleted(_jobId);
        }
    }

    function _getTalentLayerData(
        uint256 _jobId, 
        uint256 _proposalId
    ) private returns (
        IJobRegistry.Proposal memory proposal, 
        IJobRegistry.Job memory job, 
        address sender, 
        address receiver
    ) {
        IJobRegistry.Proposal memory proposal = _getProposal(_jobId, _proposalId);
        IJobRegistry.Job memory job = _getJob(_jobId);
        address sender = ITalentLayerID(talentLayerIDAddress).ownerOf(job.employerId);
        address receiver = ITalentLayerID(talentLayerIDAddress).ownerOf(proposal.employeeId);
        return (proposal, job, sender, receiver);
    }

    function _getProposal(
        uint256 _jobId, uint256 _proposalId
    ) private view returns (IJobRegistry.Proposal memory){
        return IJobRegistry(jobRegistryAddress).getProposal(_jobId, _proposalId);
    }

    function _getJob(
        uint256 _jobId
    ) private view returns (IJobRegistry.Job memory){
        return IJobRegistry(jobRegistryAddress).getJob(_jobId);
    }
}