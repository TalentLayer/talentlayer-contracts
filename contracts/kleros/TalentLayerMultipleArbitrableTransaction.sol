// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IServiceRegistry.sol";
import "../interfaces/ITalentLayerID.sol";
import "./IArbitrable.sol";
import "./Arbitrator.sol";

contract TalentLayerMultipleArbitrableTransaction {

    // =========================== Enum ==============================

    /// @notice Enum payment type
    enum PaymentType {
        Release,
        Reimburse
    }

    // =========================== Struct ==============================

    struct Transaction {
        address sender; //pays recipient using the escrow
        address receiver; //intended recipient of the escrow
        address token; //token of the escrow
        uint256 amount; //amount locked into escrow
        uint256 serviceId; //the serviceId related to the transaction
    }

    // =========================== Events ==============================
    
    /// @notice Emitted after a service is finished
    /// @param serviceId The associated service ID
    /// @param sellerId The talentLayerId of the associated seller
    /// @param transactionId The associated escrow transaction ID
    event ServiceProposalConfirmedWithDeposit(
        uint256 serviceId,
        uint256 sellerId,
        uint256 transactionId
    );

    /// @notice Emitted after each payment
    ///  @param _paymentType Whether the payment is a release or a reimbursement.
    ///  @param _amount The amount paid.
    ///  @param _token The address of the token used for the payment.
    ///  @param _serviceId The id of the concerned service.
    event Payment(
        PaymentType _paymentType,
        uint256 _amount,
        address _token,
        uint256 _serviceId
    );

    /// @notice Emitted after a service is finished
    /// @param _serviceId The service ID
    event PaymentCompleted(uint256 _serviceId);

    // =========================== Declarations ==============================
    
    Transaction[] private transactions; //transactions stored in array with index = id
    address private serviceRegistryAddress; //contract address to ServiceRegistry.sol
    address private talentLayerIDAddress; //contract address to TalentLayerID.sol

    // =========================== Constructor ==============================

    /** @dev Called on contract deployment
     *  @param _serviceRegistryAddress Contract address to ServiceRegistry.sol
     *  @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _feeTimeout Arbitration fee timeout for the parties.
     */
    constructor(
        address _serviceRegistryAddress,
        address _talentLayerIDAddress,
        Arbitrator _arbitrator, 
        bytes memory _arbitratorExtraData,
        uint _feeTimeout
    ) {
        _setServiceRegistryAddress(_serviceRegistryAddress);
        _setTalentLayerIDAddress(_talentLayerIDAddress);
        // arbitrator = _arbitrator;
        // arbitratorExtraData = _arbitratorExtraData;
        // feeTimeout = _feeTimeout;
    }

    // =========================== View functions ==============================

    

    // =========================== User functions ==============================
    
    /**  @dev Validates a proposal for a service by locking ETH into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _adminWallet Admin fee wallet.
     *  @param _adminFeeAmount Admin fee amount.
     *  @param _serviceId Service of transaction
     *  @param _serviceId Id of the service that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates. 
     */
    function createETHTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        address _adminWallet,
        uint256 _adminFeeAmount,
        uint256 _serviceId,
        uint256 _proposalId
    ) external payable {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);

        require(msg.sender == sender, "Access denied.");
        require(msg.value == proposal.rateAmount + _adminFeeAmount, "Non-matching funds.");
        require(proposal.rateToken == address(0), "Proposal token not ETH.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, proposal.rateAmount, _serviceId);
        IServiceRegistry(serviceRegistryAddress).afterDeposit(_serviceId, _proposalId, transactionId); 

        emit ServiceProposalConfirmedWithDeposit(
            _serviceId,
            proposal.sellerId,
            transactionId
        );
    }

    /**  @dev Validates a proposal for a service by locking ERC20 into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _adminWallet Admin fee wallet.
     *  @param _adminFeeAmount Admin fee amount.
     *  @param _serviceId Id of the service that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates. 
     */
    function createTokenTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        address _adminWallet,
        uint256 _adminFeeAmount,
        uint256 _serviceId,
        uint256 _proposalId
    ) external {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");
        
        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, proposal.rateAmount, _serviceId);
        IServiceRegistry(serviceRegistryAddress).afterDeposit(_serviceId, _proposalId, transactionId); 
        _deposit(sender, proposal.rateToken, proposal.rateAmount); 

        emit ServiceProposalConfirmedWithDeposit(
            _serviceId,
            proposal.sellerId,
            transactionId
        );
    }

    /**  @dev Allows the sender to release locked-in escrow value to the intended recipient.
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

        emit Payment(PaymentType.Release, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    /**  @dev Allows the intended receiver to return locked-in escrow value back to the sender.
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

        emit Payment(PaymentType.Reimburse, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    // =========================== Private functions ==============================

    
    function _setServiceRegistryAddress(
        address _serviceRegistryAddress
    ) private {
        serviceRegistryAddress = _serviceRegistryAddress;
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
        uint256 _serviceId
    ) private returns (uint256){
        transactions.push(
            Transaction({
                sender: _sender,
                receiver: _receiver,
                token: _token,
                amount: _amount,
                serviceId: _serviceId
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
        uint256 _serviceId, 
        uint256 _amount
    ) private {
        if (_amount == 0) {
            IServiceRegistry(serviceRegistryAddress).afterFullPayment(_serviceId);
            emit PaymentCompleted(_serviceId);
        }
    }

    function _getTalentLayerData(
        uint256 _serviceId, 
        uint256 _proposalId
    ) private returns (
        IServiceRegistry.Proposal memory proposal, 
        IServiceRegistry.Service memory service, 
        address sender, 
        address receiver
    ) {
        IServiceRegistry.Proposal memory proposal = _getProposal(_serviceId, _proposalId);
        IServiceRegistry.Service memory service = _getService(_serviceId);
        address sender = ITalentLayerID(talentLayerIDAddress).ownerOf(service.buyerId);
        address receiver = ITalentLayerID(talentLayerIDAddress).ownerOf(proposal.sellerId);
        return (proposal, service, sender, receiver);
    }

    function _getProposal(
        uint256 _serviceId, uint256 _proposalId
    ) private view returns (IServiceRegistry.Proposal memory){
        return IServiceRegistry(serviceRegistryAddress).getProposal(_serviceId, _proposalId);
    }

    function _getService(
        uint256 _serviceId
    ) private view returns (IServiceRegistry.Service memory){
        return IServiceRegistry(serviceRegistryAddress).getService(_serviceId);
    }
}