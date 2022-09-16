// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Arbitrator.sol";
import "./IArbitrable.sol";

contract MultipleArbitrableTransaction is IArbitrable {
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

    struct Transaction {
        address sender;
        address receiver;
        uint amount;
        uint timeoutPayment; // Time in seconds after which the transaction can be automatically executed if not disputed.
        uint disputeId; // If dispute exists, the ID of the dispute.
        uint senderFee; // Total fees paid by the sender.
        uint receiverFee; // Total fees paid by the receiver.
        uint lastInteraction; // Last interaction for the dispute procedure.
        Status status;
    }

    Transaction[] public transactions;
    bytes public arbitratorExtraData; // Extra data to set up the arbitration.
    Arbitrator public arbitrator; // Address of the arbitrator contract.
    uint public feeTimeout; // Time in seconds a party can take to pay arbitration fees before being considered unresponding and lose the dispute.
    address _jobRegistry;
    uint128 _jobId;
    
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
    event Ruling(
        Arbitrator indexed _arbitrator,
        uint indexed _disputeID,
        uint _ruling
    );

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
        Arbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        uint _feeTimeout,
        uint _jobId,
        

    ) public {
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        feeTimeout = _feeTimeout;
    }

    /** @dev Create a transaction.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _receiver The recipient of the transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @return transactionID The index of the transaction.
     */
    function createTransaction(
        uint _timeoutPayment,
        address _receiver,
        string memory _metaEvidence
    ) public payable returns (uint transactionID) {
        transactions.push(
            Transaction({
                sender: msg.sender,
                receiver: _receiver,
                amount: msg.value,
                timeoutPayment: _timeoutPayment,
                disputeId: 0,
                senderFee: 0,
                receiverFee: 0,
                lastInteraction: block.timestamp,
                status: Status.NoDispute
            })
        );
        emit MetaEvidence(transactions.length - 1, _metaEvidence);
        emit TransactionCreated(
            transactions.length - 1,
            msg.sender,
            _receiver,
            msg.value
        );

        return transactions.length - 1;
    }

    /** @dev Create a transaction. UNTRUSTED.
     *  @param _amount The amount of tokens in this transaction.
     *  @param _token The ERC20 token contract.
     *  @param _timeoutPayment Time after which a party automatically loses a dispute.
     *  @param _receiver The recipient of the transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @return The index of the transaction.
     */
    function createTokenTransaction(
        uint _amount,
        ERC20 _token,
        uint _timeoutPayment,
        address _receiver,
        string _metaEvidence
    ) public returns (uint transactionIndex) {
        // Transfers token from sender wallet to contract.
        require(_token.transferFrom(msg.sender, address(this), _amount), "Sender does not have enough approved funds.");

        transactions.push(Transaction({
            sender: msg.sender,
            receiver: _receiver,
            amount: _amount,
            token: _token,
            timeoutPayment: _timeoutPayment,
            disputeId: 0,
            senderFee: 0,
            receiverFee: 0,
            lastInteraction: now,
            status: Status.NoDispute
        }));
        emit MetaEvidence(transactions.length - 1, _metaEvidence);
        emit TransactionCreated(transactions.length - 1, msg.sender, _receiver, _token, _amount);

        return transactions.length - 1;
    }

    /** @dev Pay receiver. To be called if the good or service is provided.
     *  @param _transactionID The index of the transaction.
     *  @param _amount Amount to pay in wei.
     */
    function pay(uint _transactionID, uint _amount) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            transaction.sender == msg.sender,
            "The caller must be the sender."
        );
        require(
            transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );
        require(
            _amount <= transaction.amount,
            "The amount paid has to be less than or equal to the transaction."
        );

        transaction.receiver.transfer(_amount);
        transaction.amount -= _amount;
        emit Payment(_transactionID, _amount, msg.sender);
    }

    /** @dev Reimburse sender. To be called if the good or service can't be fully provided.
     *  @param _transactionID The index of the transaction.
     *  @param _amountReimbursed Amount to reimburse in wei.
     */
    function reimburse(uint _transactionID, uint _amountReimbursed) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            transaction.receiver == msg.sender,
            "The caller must be the receiver."
        );
        require(
            transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );
        require(
            _amountReimbursed <= transaction.amount,
            "The amount reimbursed has to be less or equal than the transaction."
        );

        transaction.sender.transfer(_amountReimbursed);
        transaction.amount -= _amountReimbursed;
        emit Payment(_transactionID, _amountReimbursed, msg.sender);
    }

    /** @dev Transfer the transaction's amount to the receiver if the timeout has passed.
     *  @param _transactionID The index of the transaction.
     */
    function executeTransaction(uint _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            now - transaction.lastInteraction >= transaction.timeoutPayment,
            "The timeout has not passed yet."
        );
        require(
            transaction.status == Status.NoDispute,
            "The transaction shouldn't be disputed."
        );

        transaction.receiver.transfer(transaction.amount);
        transaction.amount = 0;

        transaction.status = Status.Resolved;
    }

    /** @dev Reimburse sender if receiver fails to pay the fee.
     *  @param _transactionID The index of the transaction.
     */
    function timeOutBySender(uint _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            transaction.status == Status.WaitingReceiver,
            "The transaction is not waiting on the receiver."
        );
        require(
            now - transaction.lastInteraction >= feeTimeout,
            "Timeout time has not passed yet."
        );

        if (transaction.receiverFee != 0) {
            transaction.receiver.send(transaction.receiverFee);
            transaction.receiverFee = 0;
        }
        executeRuling(_transactionID, SENDER_WINS);
    }

    /** @dev Pay receiver if sender fails to pay the fee.
     *  @param _transactionID The index of the transaction.
     */
    function timeOutByReceiver(uint _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            transaction.status == Status.WaitingSender,
            "The transaction is not waiting on the sender."
        );
        require(
            now - transaction.lastInteraction >= feeTimeout,
            "Timeout time has not passed yet."
        );

        if (transaction.senderFee != 0) {
            transaction.sender.send(transaction.senderFee);
            transaction.senderFee = 0;
        }
        executeRuling(_transactionID, RECEIVER_WINS);
    }

    /** @dev Pay the arbitration fee to raise a dispute. To be called by the sender. UNTRUSTED.
     *  Note that the arbitrator can have createDispute throw, which will make this function throw and therefore lead to a party being timed-out.
     *  This is not a vulnerability as the arbitrator can rule in favor of one party anyway.
     *  @param _transactionID The index of the transaction.
     */
    function payArbitrationFeeBySender(uint _transactionID) public payable {
        Transaction storage transaction = transactions[_transactionID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(
            msg.sender == transaction.sender,
            "The caller must be the sender."
        );

        transaction.senderFee += msg.value;
        // Require that the total pay at least the arbitration cost.
        require(
            transaction.senderFee >= arbitrationCost,
            "The sender fee must cover arbitration costs."
        );

        transaction.lastInteraction = now;

        // The receiver still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.receiverFee < arbitrationCost) {
            transaction.status = Status.WaitingReceiver;
            emit HasToPayFee(_transactionID, Party.Receiver);
        } else {
            // The receiver has also paid the fee. We create the dispute.
            raiseDispute(_transactionID, arbitrationCost);
        }
    }

    /** @dev Pay the arbitration fee to raise a dispute. To be called by the receiver. UNTRUSTED.
     *  Note that this function mirrors payArbitrationFeeBySender.
     *  @param _transactionID The index of the transaction.
     */
    function payArbitrationFeeByReceiver(uint _transactionID) public payable {
        Transaction storage transaction = transactions[_transactionID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(
            msg.sender == transaction.receiver,
            "The caller must be the receiver."
        );

        transaction.receiverFee += msg.value;
        // Require that the total paid to be at least the arbitration cost.
        require(
            transaction.receiverFee >= arbitrationCost,
            "The receiver fee must cover arbitration costs."
        );

        transaction.lastInteraction = now;
        // The sender still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.senderFee < arbitrationCost) {
            transaction.status = Status.WaitingSender;
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
        Transaction storage transaction = transactions[_transactionID];
        transaction.status = Status.DisputeCreated;
        transaction.disputeId = arbitrator.createDispute.value(
            _arbitrationCost
        )(AMOUNT_OF_CHOICES, arbitratorExtraData);
        disputeIDtoTransactionID[transaction.disputeId] = _transactionID;
        emit Dispute(
            arbitrator,
            transaction.disputeId,
            _transactionID,
            _transactionID
        );

        // Refund sender if it overpaid.
        if (transaction.senderFee > _arbitrationCost) {
            uint extraFeeSender = transaction.senderFee - _arbitrationCost;
            transaction.senderFee = _arbitrationCost;
            transaction.sender.send(extraFeeSender);
        }

        // Refund receiver if it overpaid.
        if (transaction.receiverFee > _arbitrationCost) {
            uint extraFeeReceiver = transaction.receiverFee - _arbitrationCost;
            transaction.receiverFee = _arbitrationCost;
            transaction.receiver.send(extraFeeReceiver);
        }
    }

    /** @dev Submit a reference to evidence. EVENT.
     *  @param _transactionID The index of the transaction.
     *  @param _evidence A link to an evidence using its URI.
     */
    function submitEvidence(uint _transactionID, string memory _evidence)
        public
    {
        Transaction storage transaction = transactions[_transactionID];
        require(
            msg.sender == transaction.sender ||
                msg.sender == transaction.receiver,
            "The caller must be the sender or the receiver."
        );
        require(
            transaction.status < Status.Resolved,
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
        Transaction storage transaction = transactions[_transactionID];

        arbitrator.appeal.value(msg.value)(
            transaction.disputeId,
            arbitratorExtraData
        );
    }

    /** @dev Give a ruling for a dispute. Must be called by the arbitrator.
     *  The purpose of this function is to ensure that the address calling it has the right to rule on the contract.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function rule(uint _disputeID, uint _ruling) public {
        uint transactionID = disputeIDtoTransactionID[_disputeID];
        Transaction storage transaction = transactions[transactionID];
        require(
            msg.sender == address(arbitrator),
            "The caller must be the arbitrator."
        );
        require(
            transaction.status == Status.DisputeCreated,
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
        Transaction storage transaction = transactions[_transactionID];
        require(_ruling <= AMOUNT_OF_CHOICES, "Invalid ruling.");

        // Give the arbitration fee back.
        // Note that we use send to prevent a party from blocking the execution.
        if (_ruling == SENDER_WINS) {
            transaction.sender.send(transaction.senderFee + transaction.amount);
        } else if (_ruling == RECEIVER_WINS) {
            transaction.receiver.send(
                transaction.receiverFee + transaction.amount
            );
        } else {
            uint split_amount = (transaction.senderFee + transaction.amount) /
                2;
            transaction.sender.send(split_amount);
            transaction.receiver.send(split_amount);
        }

        transaction.amount = 0;
        transaction.senderFee = 0;
        transaction.receiverFee = 0;
        transaction.status = Status.Resolved;
    }

    // **************************** //
    // *     Constant getters     * //
    // **************************** //

    /** @dev Getter to know the count of transactions.
     *  @return countTransactions The count of transactions.
     */
    function getCountTransactions()
        public
        view
        returns (uint256 countTransactions)
    {
        return transactions.length;
    }

    /** @dev Get IDs for transactions where the specified address is the receiver and/or the sender.
     *  This function must be used by the UI and not by other smart contracts.
     *  Note that the complexity is O(t), where t is amount of arbitrable transactions.
     *  @param _address The specified address.
     *  @return transactionIDs The transaction IDs.
     */
    function getTransactionIDsByAddress(address _address)
        public
        view
        returns (uint256[] memory transactionIDs)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (
                transactions[i].sender == _address ||
                transactions[i].receiver == _address
            ) count++;
        }

        transactionIDs = new uint256[](count);

        count = 0;

        for (uint256 j = 0; j < transactions.length; j++) {
            if (
                transactions[j].sender == _address ||
                transactions[j].receiver == _address
            ) transactionIDs[count++] = j;
        }
    }
}
