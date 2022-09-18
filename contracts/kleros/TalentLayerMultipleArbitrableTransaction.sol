// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Arbitrator.sol";
import "./IArbitrable.sol";
import "../interfaces/IJobRegistry.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ITalentLayerID} from "../interfaces/ITalentLayerID.sol";

import "hardhat/console.sol";

contract TalentLayerMultipleArbitrableTransaction is IArbitrable {
    // **************************** //
    // *    Contract variables    * //
    // **************************** //

    uint8 constant AMOUNT_OF_CHOICES = 2;
    uint8 constant SENDER_WINS = 1;
    uint8 constant RECEIVER_WINS = 2;

    enum Party {
        Sender,
        Receiver
    }
    enum Status {
        NoDispute,
        WaitingSender,
        WaitingReceiver,
        DisputeCreated,
        Resolved
    }

    struct WalletFee {
        address payable wallet;
        uint fee;
    }

    struct Transaction {
        address payable sender;
        address payable receiver;
        uint amount;
        uint timeoutPayment; // Time in seconds after which the transaction can be automatically executed if not disputed.
        uint disputeId; // If dispute exists, the ID of the dispute.
        uint senderFee; // Total fees paid by the sender.
        uint receiverFee; // Total fees paid by the receiver.
        uint lastInteraction; // Last interaction for the dispute procedure.
        Status status;
    }

    struct ExtendedTransaction {
        address token;
        Transaction _transaction;
        WalletFee adminFee;
        uint256 jobId;
    }

    ExtendedTransaction[] public transactions;
    bytes public arbitratorExtraData; // Extra data to set up the arbitration.
    Arbitrator public arbitrator; // Address of the arbitrator contract.
    uint public feeTimeout; // Time in seconds a party can take to pay arbitration fees before being considered unresponding and lose the dispute.
    address jobRegistryAddress;
    address talentLayerIDAddress;
    JobRegistry jobRegistry;

    mapping(uint256 => uint256) public disputeIDtoTransactionID; // One-to-one relationship between the dispute and the transaction.

    // **************************** //
    // *          Events          * //
    // **************************** //

    /** @dev To be emitted when a party pays or reimburses the other.
     *  @param _transactionID The index of the transaction.
     *  @param _amount The amount paid.
     *  @param _party The party that paid.
     */
    event Payment(uint indexed _transactionID, uint _amount, address _party);

    /** @dev Indicate that a party has to pay a fee or would otherwise be considered as losing.
     *  @param _transactionID The index of the transaction.
     *  @param _party The party who has to pay.
     */
    event HasToPayFee(uint indexed _transactionID, Party _party);

    /** @dev To be raised when a ruling is given.
     *  @param _arbitrator The arbitrator giving the ruling.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling The ruling which was given.
     */
    // event Ruling(Arbitrator indexed _arbitrator, uint indexed _disputeID, uint _ruling);

    /** @dev Emitted when a transaction is created.
     *  @param _transactionID The index of the transaction.
     *  @param _sender The address of the sender.
     *  @param _receiver The address of the receiver.
     *  @param _amount The initial amount in the transaction.
     */
    event TransactionCreated(
        uint _transactionID,
        address indexed _sender,
        address indexed _receiver,
        uint _amount
    );

    // **************************** //
    // *    Arbitrable functions  * //
    // *    Modifying the state   * //
    // **************************** //

    /** @dev Constructor.
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
        setJobRegistryAddress(_jobRegistryAddress);
        setTalentLayerIDAddress(_talentLayerIDAddress);
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        feeTimeout = _feeTimeout;
    }

    /** @dev Allows changing the contract address to JobRegistry.sol
     *  @param _jobRegistryAddress The new contract address.
     */
    function setJobRegistryAddress(address _jobRegistryAddress) internal {
        jobRegistryAddress = _jobRegistryAddress;
    }

    function setTalentLayerIDAddress(address _talentLayerIDAddress) internal {
        talentLayerIDAddress = _talentLayerIDAddress;
    }

    function getProposal(uint256 _jobId, uint256 _proposalId) private view returns (IJobRegistry.Proposal memory){
        return IJobRegistry(jobRegistryAddress).getProposal(_jobId, _proposalId);
    }

    function getJob(uint256 _jobId) private view returns (IJobRegistry.Job memory){
        return IJobRegistry(jobRegistryAddress).getJob(_jobId);
    }

    struct JobRegistry{
        IJobRegistry.Proposal proposal;
        IJobRegistry.Job job;
        address payable sender;
        address payable receiver;
    }

    function createTransaction(
        uint _timeoutPayment,
        string memory _metaEvidence,
        address payable _adminWallet,
        uint _adminFeeAmount,
        uint256 _jobId,
        uint256 _proposalId
    ) public payable returns (uint transactionID) {
        /*JobRegistry memory proposal = getProposal(_jobId, _proposalId);
        JobRegistry memory job = getJob(_jobId);
        address payable sender = payable(ITalentLayerID(talentLayerIDAddress).ownerOf(job.employerId));
        address payable receiver = payable(ITalentLayerID(talentLayerIDAddress).ownerOf(proposal.employeeId));
*/
        jobRegistry.proposal = getProposal(_jobId, _proposalId);
        jobRegistry.job = getJob(_jobId);
        jobRegistry.sender = payable(ITalentLayerID(talentLayerIDAddress).ownerOf(jobRegistry.job.employerId));
        jobRegistry.receiver = payable(ITalentLayerID(talentLayerIDAddress).ownerOf(jobRegistry.proposal.employeeId));

        require(jobRegistry.sender != jobRegistry.receiver, "Sender and receiver must be different");
        require(msg.sender == jobRegistry.sender, "Sender must be the owner of the job");
        

        if(jobRegistry.proposal.rateToken != address(0)){ 

            IERC20 token = IERC20(jobRegistry.proposal.rateToken);
             // Transfers token from sender wallet to contract. Permit before transfer
            require(
                 token.transferFrom(jobRegistry.sender, address(this), jobRegistry.proposal.rateAmount), 
                 "Sender does not have enough approved funds."
            );
        }

        require(
            jobRegistry.proposal.rateAmount + _adminFeeAmount == msg.value,
            "Fees don't match with payed amount"
        );
        
        WalletFee memory _adminFee = WalletFee(_adminWallet, _adminFeeAmount);
        Transaction memory _rawTransaction = _initTransaction(jobRegistry.sender, jobRegistry.receiver, jobRegistry.proposal.rateAmount, _timeoutPayment);
        
        ExtendedTransaction memory _transaction = ExtendedTransaction({
            token: jobRegistry.proposal.rateToken,
            _transaction: _rawTransaction,
            adminFee: _adminFee,
            jobId: _jobId
        });
        
        transactions.push(_transaction);

        emit MetaEvidence(transactions.length - 1, _metaEvidence);
        
        IJobRegistry(jobRegistryAddress).afterDeposit(_jobId, _proposalId, transactions.length - 1);
        
        return transactions.length - 1;
    }



    /** @dev Pay receiver. To be called if the good or service is provided.
     *  @param _transactionID The index of the transaction.
     *  @param _amount Amount to pay in wei.
     */
    function pay(uint _transactionID, uint _amount) public {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            transaction._transaction.sender == msg.sender,
            "The caller must be the sender."
        );
        require(
            transaction._transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );
        require(
            _amount <= transaction._transaction.amount,
            "The amount paid has to be less than or equal to the transaction."
        );

        _handleTransactionTransfer(
            _transactionID,
            transaction._transaction.receiver,
            _amount,
            transaction._transaction.amount - _amount,
            transaction.token != address(0),
            "pay",
            true
        );

        if(transaction._transaction.amount == 0){
            IJobRegistry(jobRegistryAddress).afterFullPayment(transaction.jobId);
        }
    }

    /** @dev Reimburse sender. To be called if the good or service can't be fully provided.
     *  @param _transactionID The index of the transaction.
     *  @param _amountReimbursed Amount to reimburse in wei.
     */
    function reimburse(uint _transactionID, uint _amountReimbursed) public {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            transaction._transaction.receiver == msg.sender,
            "The caller must be the receiver."
        );
        require(
            transaction._transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );
        require(
            _amountReimbursed <= transaction._transaction.amount,
            "The amount reimbursed has to be less or equal than the transaction."
        );

        _handleTransactionTransfer(
            _transactionID,
            transaction._transaction.sender,
            _amountReimbursed,
            transaction._transaction.amount - _amountReimbursed,
            transaction.token != address(0),
            "reimburse",
            true
        );
    }

    /** @dev Transfer the transaction's amount to the receiver if the timeout has passed.
     *  @param _transactionID The index of the transaction.
     */
    function executeTransaction(uint _transactionID) public {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            block.timestamp - transaction._transaction.lastInteraction >= transaction._transaction.timeoutPayment,
            "The timeout has not passed yet."
        );
        require(
            transaction._transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );

        _handleTransactionTransfer(
            _transactionID,
            transaction._transaction.receiver,
            transaction._transaction.amount,
            0,
            transaction.token != address(0),
            "pay",
            false
        );
        transaction._transaction.status = Status.Resolved;
    }

    /** @dev Reimburse sender if receiver fails to pay the fee.
     *  @param _transactionID The index of the transaction.
     */
    function timeOutBySender(uint _transactionID) public {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            transaction._transaction.status == Status.WaitingReceiver,
            "The transaction is not waiting on the receiver."
        );
        require(
            block.timestamp - transaction._transaction.lastInteraction >= feeTimeout,
            "Timeout time has not passed yet."
        );

        /*if (transaction._transaction.receiverFee != 0) {
            transaction._transaction.receiver.transfer(transaction._transaction.receiverFee);
            transaction._transaction.receiverFee = 0;
        }*/
        executeRuling(_transactionID, SENDER_WINS);
    }

    /** @dev Pay receiver if sender fails to pay the fee.
     *  @param _transactionID The index of the transaction.
     */
    function timeOutByReceiver(uint _transactionID) public {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            transaction._transaction.status == Status.WaitingSender,
            "The transaction is not waiting on the sender."
        );
        require(
            block.timestamp - transaction._transaction.lastInteraction >= feeTimeout,
            "Timeout time has not passed yet."
        );

        /*if (transaction.senderFee != 0) {
            transaction.sender.transfer(transaction.senderFee);
            transaction.senderFee = 0;
        }*/
        executeRuling(_transactionID, RECEIVER_WINS);
    }

    /** @dev Pay the arbitration fee to raise a dispute. To be called by the sender. UNTRUSTED.
     *  Note that the arbitrator can have createDispute throw, which will make this function throw and therefore lead to a party being timed-out.
     *  This is not a vulnerability as the arbitrator can rule in favor of one party anyway.
     *  @param _transactionID The index of the transaction.
     */
    function payArbitrationFeeBySender(uint _transactionID) public payable {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        require(
            transaction._transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(
            msg.sender == transaction._transaction.sender,
            "The caller must be the sender."
        );

        transaction._transaction.senderFee += msg.value;
        // Require that the total pay at least the arbitration cost.
        require(
            transaction._transaction.senderFee >= arbitrationCost,
            "The sender fee must cover arbitration costs."
        );

        transaction._transaction.lastInteraction = block.timestamp;

        // The receiver still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction._transaction.receiverFee < arbitrationCost) {
            transaction._transaction.status = Status.WaitingReceiver;
            emit HasToPayFee(_transactionID, Party.Receiver);
        } else {
            // The receiver has also paid the fee. We create the dispute.
            raiseDispute(_transactionID, arbitrationCost);
            //performTransactionFee(transaction, "reimburse");
        }
    }

    /** @dev Pay the arbitration fee to raise a dispute. To be called by the receiver. UNTRUSTED.
     *  Note that this function mirrors payArbitrationFeeBySender.
     *  @param _transactionID The index of the transaction.
     */
    function payArbitrationFeeByReceiver(uint _transactionID) public payable {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        require(
            transaction._transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(
            msg.sender == transaction._transaction.receiver,
            "The caller must be the receiver."
        );

        transaction._transaction.receiverFee += msg.value;
        // Require that the total paid to be at least the arbitration cost.
        require(
            transaction._transaction.receiverFee >= arbitrationCost,
            "The receiver fee must cover arbitration costs."
        );

        transaction._transaction.lastInteraction = block.timestamp;
        // The sender still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction._transaction.senderFee < arbitrationCost) {
            transaction._transaction.status = Status.WaitingSender;
            emit HasToPayFee(_transactionID, Party.Sender);
        } else {
            // The sender has also paid the fee. We create the dispute.
            raiseDispute(_transactionID, arbitrationCost);
        }
    }

    /** @dev Create a dispute. UNTRUSTED.
     *  @param _transactionID The index of the transaction.
     *  @param _arbitrationCost Amount to pay the arbitrator.
     */
    function raiseDispute(uint _transactionID, uint _arbitrationCost) internal {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        transaction._transaction.status = Status.DisputeCreated;
        transaction._transaction.disputeId = arbitrator.createDispute{value: _arbitrationCost}(AMOUNT_OF_CHOICES, arbitratorExtraData);
        disputeIDtoTransactionID[transaction._transaction.disputeId] = _transactionID;
        emit Dispute(
            arbitrator,
            transaction._transaction.disputeId,
            _transactionID,
            _transactionID
        );

        // Refund sender if it overpaid.
        if (transaction._transaction.senderFee > _arbitrationCost) {
            uint extraFeeSender = transaction._transaction.senderFee - _arbitrationCost;
            transaction._transaction.senderFee = _arbitrationCost;
            transaction._transaction.sender.transfer(extraFeeSender);
        }

        // Refund receiver if it overpaid.
        if (transaction._transaction.receiverFee > _arbitrationCost) {
            uint extraFeeReceiver = transaction._transaction.receiverFee - _arbitrationCost;
            transaction._transaction.receiverFee = _arbitrationCost;
            transaction._transaction.receiver.transfer(extraFeeReceiver);
        }
    }

    /** @dev Submit a reference to evidence. EVENT.
     *  @param _transactionID The index of the transaction.
     *  @param _evidence A link to an evidence using its URI.
     */
    function submitEvidence(uint _transactionID, string memory _evidence)
        public
    {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(
            msg.sender == transaction._transaction.sender ||
                msg.sender == transaction._transaction.receiver,
            "The caller must be the sender or the receiver."
        );
        require(
            transaction._transaction.status < Status.Resolved,
            "Must not send evidence if the dispute is resolved."
        );

        emit Evidence(arbitrator, _transactionID, msg.sender, _evidence);
    }

    /** @dev Appeal an appealable ruling.
     *  Transfer the funds to the arbitrator.
     *  Note that no checks are required as the checks are done by the arbitrator.
     *  @param _transactionID The index of the transaction.
     */
    function appeal(uint _transactionID) public payable {
        ExtendedTransaction storage transaction = transactions[_transactionID];

        arbitrator.appeal{value: msg.value}(transaction._transaction.disputeId, arbitratorExtraData);
    }

    /** @dev Give a ruling for a dispute. Must be called by the arbitrator.
     *  The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function rule(uint _disputeID, uint _ruling) public {
        uint transactionID = disputeIDtoTransactionID[_disputeID];
        ExtendedTransaction storage transaction = transactions[transactionID];
        require(
            msg.sender == address(arbitrator),
            "The caller must be the arbitrator."
        );
        require(
            transaction._transaction.status == Status.DisputeCreated,
            "The dispute has already been resolved."
        );

        emit Ruling(Arbitrator(msg.sender), _disputeID, _ruling);

        executeRuling(transactionID, _ruling);
    }

    /** @dev Execute a ruling of a dispute. It reimburses the fee to the winning party.
     *  @param _transactionID The index of the transaction.
     *  @param _ruling Ruling given by the arbitrator. 1 : Reimburse the receiver. 2 : Pay the sender.
     */
    function executeRuling(uint _transactionID, uint _ruling) internal {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        require(_ruling <= AMOUNT_OF_CHOICES, "Invalid ruling.");

        // Give the arbitration fee back.
        // Note that we use send to prevent a party from blocking the execution.
        if (_ruling == SENDER_WINS) {
            transaction._transaction.sender.transfer(transaction._transaction.senderFee + transaction._transaction.amount);
            performTransactionFee(transaction, "reimburse");
        } else if (_ruling == RECEIVER_WINS) {
            transaction._transaction.receiver.transfer(
                transaction._transaction.receiverFee + transaction._transaction.amount
            );
            performTransactionFee(transaction, "pay");
        } else {
            uint split_amount = (transaction._transaction.senderFee + transaction._transaction.amount) /
                2;
            transaction._transaction.sender.transfer(split_amount);
            transaction._transaction.receiver.transfer(split_amount);
            performTransactionFee(transaction, "reimburse");
        }

        transaction._transaction.amount = 0;
        transaction._transaction.senderFee = 0;
        transaction._transaction.receiverFee = 0;
        transaction._transaction.status = Status.Resolved;
    }

    // **************************** //
    // *     Help functions       * //
    // **************************** //

    function _initTransaction(
        address payable _sender,
        address payable _receiver,
        uint256 _rateAmount,
        uint _timeoutPayment
    ) private view returns (Transaction memory) {
        return Transaction({
            sender: _sender,
            receiver: _receiver,
            amount: _rateAmount,
            timeoutPayment: _timeoutPayment,
            disputeId: 0,
            senderFee: 0,
            receiverFee: 0,
            lastInteraction: block.timestamp,
            status: Status.NoDispute
        });
    }

    function _handleTransactionTransfer(
        uint _transactionID,
        address payable destination,
        uint amount,
        uint finalAmount,
        bool isToken,
        string memory feeMode,
        bool emitPayment

    ) private {
        ExtendedTransaction storage transaction = transactions[_transactionID];
        if (isToken) {
            require(
                IERC20(transaction.token).transfer(destination, amount),
                "The `transfer` function must not fail."
            );
        } else {
            destination.transfer(amount);
        }
        transaction._transaction.amount = finalAmount;

        // TODO: we should be done only one time 
        // performTransactionFee(transaction, feeMode);

        if (emitPayment) {
            emit Payment(_transactionID, amount, msg.sender);
        }
    }


    function performTransactionFee(ExtendedTransaction memory transaction, string memory mode) private {
        if (compareStrings(mode, "pay")) {
            transaction.adminFee.wallet.transfer(transaction.adminFee.fee);
        } else {
            transaction._transaction.sender.transfer(transaction.adminFee.fee);
        }
    }

    function compareStrings(string memory a, string memory b) private pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }


    // **************************** //
    // *     Constant getters     * //
    // **************************** //

    /** @dev Getter to know the count of transactions.
     *  @return countTransactions The count of transactions.
     */
    function getCountTransactions() public view returns (uint256 countTransactions){
        return transactions.length;
    }

    /** @dev Get IDs for transactions where the specified address is the receiver and/or the sender.
     *  This function must be used by the UI and not by other smart contracts.
     *  Note that the complexity is O(t), where t is amount of arbitrable transactions.
     *  @param _address The specified address.
     *  @return transactionIDs The transaction IDs.
     */
    function getTransactionIDsByAddress(address _address) public view returns (uint256[] memory transactionIDs) {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (
                transactions[i]._transaction.sender == _address ||
                transactions[i]._transaction.receiver == _address
            ) count++;
        }

        transactionIDs = new uint256[](count);

        count = 0;

        for (uint256 j = 0; j < transactions.length; j++) {
            if (
                transactions[j]._transaction.sender == _address ||
                transactions[j]._transaction.receiver == _address
            ) transactionIDs[count++] = j;
        }
    }
}
