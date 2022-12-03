// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IServiceRegistry.sol";
import "../interfaces/ITalentLayerID.sol";
import "../interfaces/ITalentLayerPlatformID.sol";
import "./IArbitrable.sol";
import "./Arbitrator.sol";

contract TalentLayerMultipleArbitrableTransaction is Ownable, IArbitrable {
    // =========================== Enum ==============================

    /**
     * @notice Enum payment type
     */
    enum PaymentType {
        Release,
        Reimburse
    }

    /**
     * @notice party type enum
     */
    enum Party {
        Sender,
        Receiver
    }

    /**
     * @notice Transaction status enum
     */
    enum Status {
        NoDispute, // no dispute has arisen about the transaction
        WaitingSender, // receiver has paid arbitration fee, while sender still has to do it
        WaitingReceiver, // sender has paid arbitration fee, while receiver still has to do it
        DisputeCreated, // both parties have paid the arbitration fee and a dispute has been created
        Resolved // the transaction is solved (either no dispute has ever arisen or the dispute has been resolved)
    }

    // =========================== Struct ==============================

    /**
     * @notice Transaction struct
     * @param sender The party paying the escrow amount
     * @param receiver The intended receiver of the escrow amount
     * @param token The token used for the transaction
     * @param amount The amount of the transaction EXCLUDING FEES
     * @param serviceId The ID of the associated service
     * @param protocolFee The %fee (per ten thousands) paid to the protocol's owner
     * @param originPlatformFee The %fee (per ten thousands) paid to the platform who onboarded the user
     * @param platformFee The %fee (per ten thousands) paid to the platform on which the transaction was created
     * @param timeoutPayment The time in seconds after which a party automatically loose a dispute
     * @param disputeId // The ID of the dispute, if it exists
     * @param senderFee // // Total fees paid by the sender.
     * @param receiverFee // Total fees paid by the receiver.
     * @param lastInteraction // Last interaction for the dispute procedure.
     * @param status The status of the transaction
     * @param arbitrator // The address of the contract that can rule on a dispute for the transaction.
     */
    struct Transaction {
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 serviceId;
        uint16 protocolFee;
        uint16 originPlatformFee;
        uint16 platformFee;
        uint256 timeoutPayment;
        uint256 disputeId;
        uint256 senderFee;
        uint256 receiverFee;
        uint256 lastInteraction;
        Status status;
        Arbitrator arbitrator;
    }

    // =========================== Events ==============================

    /**
     * @notice Emitted after a service is finished
     * @param serviceId The associated service ID
     * @param sellerId The talentLayerId of the associated seller
     * @param transactionId The associated escrow transaction ID
     */
    event ServiceProposalConfirmedWithDeposit(uint256 serviceId, uint256 sellerId, uint256 transactionId);

    /**
     * @notice Emitted after each payment
     * @param _paymentType Whether the payment is a release or a reimbursement.
     * @param _amount The amount paid.
     * @param _token The address of the token used for the payment.
     * @param _serviceId The id of the concerned service.
     */
    event Payment(PaymentType _paymentType, uint256 _amount, address _token, uint256 _serviceId);

    /**
     * @notice Emitted after a service is finished
     * @param _serviceId The service ID
     */
    event PaymentCompleted(uint256 _serviceId);

    /**
     * @notice Emitted after the protocol fee was updated
     * @param _protocolFee The new protocol fee
     */
    event ProtocolFeeUpdated(uint16 _protocolFee);

    /**
     * @notice Emitted after the origin platform fee was updated
     * @param _originPlatformFee The new origin platform fee
     */
    event OriginPlatformFeeUpdated(uint256 _originPlatformFee);

    /**
     * @notice Emitted after a platform withdraws its balance
     * @param _platformId The Platform ID to which the balance is transferred.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount transferred.
     */
    event FeesClaimed(uint256 _platformId, address indexed _token, uint256 _amount);

    /**
     * @notice Emitted after an OriginPlatformFee is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event OriginPlatformFeeReleased(uint256 _platformId, uint256 _serviceId, address indexed _token, uint256 _amount);

    /**
     * @notice Emitted after a PlatformFee is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event PlatformFeeReleased(uint256 _platformId, uint256 _serviceId, address indexed _token, uint256 _amount);

    /** @notice Emitted when a party has to pay a fee for the dispute or would otherwise be considered as losing.
     *  @param _serviceId The service ID
     *  @param _transactionID The index of the transaction.
     *  @param _party The party who has to pay.
     */
    event HasToPayFee(uint256 indexed _serviceId, uint256 indexed _transactionID, Party _party);

    // =========================== Declarations ==============================

    /**
     * @notice The index of the protocol in the "platformIdToTokenToBalance" mapping
     */
    uint8 private constant PROTOCOL_INDEX = 0;
    uint16 private constant FEE_DIVIDER = 10000;

    /**
     * @notice Transactions stored in array with index = id
     */
    Transaction[] private transactions;

    /**
     * @notice Mapping from platformId to Token address to Token Balance
     *         Represents the amount of ETH or token present on this contract which
     *         belongs to a platform and can be withdrawn.
     * @dev Id 0 is reserved to the protocol balance & address(0) to ETH balance
     */
    mapping(uint256 => mapping(address => uint256)) private platformIdToTokenToBalance;

    /**
     * @notice Instance of ServiceRegistry.sol
     */
    IServiceRegistry private serviceRegistryContract;

    /**
     * @notice Instance of TalentLayerID.sol
     */
    ITalentLayerID private talentLayerIdContract;

    /**
     * @notice Instance of TalentLayerPlatformID.sol
     */
    ITalentLayerPlatformID private talentLayerPlatformIdContract;

    /**
     * @notice Percentage paid to the protocol (per 10,000, upgradable)
     */
    uint16 public protocolFee;

    /**
     * @notice Percentage paid to the platform who onboarded the user (per 10,000, upgradable)
     */
    uint16 public originPlatformFee;

    /**
     * @notice (Upgradable) Wallet which will receive the protocol fees
     */
    address payable private protocolWallet;

    /**
     * @notice Amount of choices available for ruling the disputes
     */
    uint8 constant AMOUNT_OF_CHOICES = 2;

    /**
     * @notice Ruling id for sender to win the dispute
     */
    uint8 constant SENDER_WINS = 1;

    /**
     * @notice Ruling id for receiver to win the dispute
     */
    uint8 constant RECEIVER_WINS = 2;

    /**
     * @notice Time in seconds a party can take to pay arbitration fees before being considered unresponding and lose the dispute.
     */
    uint256 public feeTimeout;

    /**
     * @notice One-to-one relationship between the dispute and the transaction.
     */
    mapping(uint256 => uint256) public disputeIDtoTransactionID;

    // =========================== Constructor ==============================

    /**
     * @dev Called on contract deployment
     * @param _serviceRegistryAddress Contract address to ServiceRegistry.sol
     * @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     * @param _talentLayerPlatformIDAddress Contract address to TalentLayerPlatformID.sol
     * @param _arbitrator The arbitrator of the contract.
     * @param _arbitratorExtraData Extra data for the arbitrator.
     * @param _feeTimeout Arbitration fee timeout for the parties.
     */
    constructor(
        address _serviceRegistryAddress,
        address _talentLayerIDAddress,
        address _talentLayerPlatformIDAddress,
        Arbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        uint256 _feeTimeout
    ) {
        serviceRegistryContract = IServiceRegistry(_serviceRegistryAddress);
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIDAddress);
        protocolFee = 100;
        originPlatformFee = 200;
        protocolWallet = payable(owner());
        // arbitrator = _arbitrator;
        // arbitratorExtraData = _arbitratorExtraData;
        feeTimeout = _feeTimeout;
    }

    // =========================== View functions ==============================

    /**
     * @dev Only the owner can execute this function
     * @return protocolWallet - The Protocol wallet
     */
    function getProtocolWallet() external view onlyOwner returns (address) {
        return protocolWallet;
    }

    /**
     * @dev Only the owner of the platform ID can execute this function
     * @param _token Token address ("0" for ETH)
     * @return balance The balance of the platform
     */
    function getClaimableFeeBalance(address _token) external view returns (uint256 balance) {
        if (owner() == msg.sender) {
            return platformIdToTokenToBalance[PROTOCOL_INDEX][_token];
        } else {
            uint256 platformId = talentLayerPlatformIdContract.getPlatformIdFromAddress(msg.sender);
            talentLayerPlatformIdContract.isValid(platformId);
            return platformIdToTokenToBalance[platformId][_token];
        }
    }

    /**
     * @notice Called to get the details of a transaction
     * @dev Only the transaction sender or receiver can call this function
     * @param _transactionId Id of the transaction
     * @return transaction The transaction details
     */
    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory transaction) {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];
        require(
            msg.sender == transaction.sender || msg.sender == transaction.receiver,
            "You are not related to this transaction."
        );
        return transaction;
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Updated the Protocol Fee
     * @dev Only the owner can call this function
     * @param _protocolFee The new protocol fee
     */
    function updateProtocolFee(uint16 _protocolFee) external onlyOwner {
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    /**
     * @notice Updated the Origin Platform Fee
     * @dev Only the owner can call this function
     * @param _originPlatformFee The new origin platform fee
     */
    function updateOriginPlatformFee(uint16 _originPlatformFee) external onlyOwner {
        originPlatformFee = _originPlatformFee;
        emit OriginPlatformFeeUpdated(_originPlatformFee);
    }

    /**
     * @notice Updated the Protocol wallet
     * @dev Only the owner can call this function
     * @param _protocolWallet The new wallet address
     */
    function updateProtocolWallet(address payable _protocolWallet) external onlyOwner {
        protocolWallet = _protocolWallet;
    }

    // =========================== User functions ==============================

    /**
     * @dev Validates a proposal for a service by locking ETH into escrow.
     * @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     * @param _metaEvidence Link to the meta-evidence.
     * @param _serviceId Service of transaction
     * @param _serviceId Id of the service that the sender created and the proposal was made for.
     * @param _proposalId Id of the proposal that the transaction validates.
     */
    function createETHTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId,
        Arbitrator _arbitrator
    ) external payable {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        // PlatformFee is per ten thousands
        uint16 platformFee = talentLayerPlatformIdContract.getPlatformFee(service.platformId);

        uint256 transactionAmount = _calculateTotalEscrowAmount(proposal.rateAmount, platformFee);

        require(msg.sender == sender, "Access denied.");
        require(msg.value == transactionAmount, "Non-matching funds.");
        require(proposal.rateToken == address(0), "Proposal token not ETH.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(
            sender,
            receiver,
            proposal.rateToken,
            proposal.rateAmount,
            _serviceId,
            platformFee,
            _timeoutPayment,
            _arbitrator
        );
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);

        emit MetaEvidence(transactionId, _metaEvidence);
        emit ServiceProposalConfirmedWithDeposit(_serviceId, proposal.sellerId, transactionId);
    }

    /**
     * @dev Validates a proposal for a service by locking ERC20 into escrow.
     * @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     * @param _metaEvidence Link to the meta-evidence.
     * @param _serviceId Id of the service that the sender created and the proposal was made for.
     * @param _proposalId Id of the proposal that the transaction validates.
     */
    function createTokenTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId,
        Arbitrator _arbitrator
    ) external {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        // PlatformFee is per ten thousands
        uint16 platformFee = talentLayerPlatformIdContract.getPlatformFee(service.platformId);

        uint256 transactionAmount = _calculateTotalEscrowAmount(proposal.rateAmount, platformFee);

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        uint256 transactionId = _saveTransaction(
            sender,
            receiver,
            proposal.rateToken,
            proposal.rateAmount,
            _serviceId,
            platformFee,
            _timeoutPayment,
            _arbitrator
        );
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);
        _deposit(sender, proposal.rateToken, transactionAmount);

        emit MetaEvidence(transactionId, _metaEvidence);
        emit ServiceProposalConfirmedWithDeposit(_serviceId, proposal.sellerId, transactionId);
    }

    /**
     * @notice Allows the sender to release locked-in escrow value to the intended recipient.
     *         The amount released must not include the fees.
     * @param _transactionId Id of the transaction to release escrow value for.
     * @param _amount Value to be released without fees. Should not be more than amount locked in.
     */
    function release(uint256 _transactionId, uint256 _amount) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.sender == msg.sender, "Access denied.");
        require(transaction.status == Status.NoDispute, "The transaction shouldn't be disputed.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _release(transaction, _amount);

        emit Payment(PaymentType.Release, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    /**
     * @notice Allows the intended receiver to return locked-in escrow value back to the sender.
     *         The amount reimbursed must not include the fees.
     * @param _transactionId Id of the transaction to reimburse escrow value for.
     * @param _amount Value to be reimbursed without fees. Should not be more than amount locked in.
     */
    function reimburse(uint256 _transactionId, uint256 _amount) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.receiver == msg.sender, "Access denied.");
        require(transaction.status == Status.NoDispute, "The transaction shouldn't be disputed.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _reimburse(transaction, _amount);

        emit Payment(PaymentType.Reimburse, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    /**
     * @notice Transfers the locked-in escrow funds to the receiver if the timeout for payment has passed
     *         and there is no dispute.
     * @param _transactionID Id of the transaction to execute.
     */
    function executeTransaction(uint256 _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            block.timestamp - transaction.lastInteraction >= transaction.timeoutPayment,
            "The timeout has not passed yet."
        );
        require(transaction.status == Status.NoDispute, "The transaction shouldn't be disputed.");

        uint256 amount = transaction.amount;
        transaction.amount = 0;
        _transferBalance(payable(transaction.receiver), transaction.token, amount);

        transaction.status = Status.Resolved;
    }

    /** @notice Allows the sender of the transaction to pay the arbitration fee to raise a dispute.
     *  Note that the arbitrator can have createDispute throw, which will make this function throw and therefore lead to a party being timed-out.
     *  This is not a vulnerability as the arbitrator can rule in favor of one party anyway.
     *  @param _transactionID Id of the transaction.
     */
    function payArbitrationFeeBySender(uint256 _transactionID) public payable {
        Transaction storage transaction = transactions[_transactionID];
        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost("");

        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(msg.sender == transaction.sender, "The caller must be the sender.");

        transaction.senderFee += msg.value;
        // The total fees paid by the sender should be at least the arbitration cost.
        require(transaction.senderFee >= arbitrationCost, "The sender fee must cover arbitration costs.");

        transaction.lastInteraction = block.timestamp;

        // The receiver still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.receiverFee < arbitrationCost) {
            transaction.status = Status.WaitingReceiver;
            emit HasToPayFee(transaction.serviceId, _transactionID, Party.Receiver);
        } else {
            // The receiver has also paid the fee. We create the dispute.
            _raiseDispute(_transactionID, arbitrationCost);
        }
    }

    /** @notice Allows the receiver of the transaction to pay the arbitration fee to raise a dispute.
     *  Note that this function mirrors payArbitrationFeeBySender.
     *  @param _transactionID Id of the transaction.
     */
    function payArbitrationFeeByReceiver(uint256 _transactionID) public payable {
        Transaction storage transaction = transactions[_transactionID];
        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost("");

        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(msg.sender == transaction.receiver, "The caller must be the receiver.");

        transaction.receiverFee += msg.value;
        // The total fees paid by the receiver should be at least the arbitration cost.
        require(transaction.receiverFee >= arbitrationCost, "The receiver fee must cover arbitration costs.");

        transaction.lastInteraction = block.timestamp;
        // The sender still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.senderFee < arbitrationCost) {
            transaction.status = Status.WaitingSender;
            emit HasToPayFee(transaction.serviceId, _transactionID, Party.Sender);
        } else {
            // The sender has also paid the fee. We create the dispute.
            _raiseDispute(_transactionID, arbitrationCost);
        }
    }

    /** @notice Reimburses sender if receiver fails to pay the arbitration fee.
     *  @param _transactionID Id of the transaction.
     */
    function timeOutBySender(uint256 _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(transaction.status == Status.WaitingReceiver, "The transaction is not waiting on the receiver.");
        require(block.timestamp - transaction.lastInteraction >= feeTimeout, "Timeout time has not passed yet.");

        // Reimburse receiver if has paid any fees.
        if (transaction.receiverFee != 0) {
            uint256 receiverFee = transaction.receiverFee;
            transaction.receiverFee = 0;
            payable(transaction.receiver).transfer(receiverFee);
        }

        _executeRuling(_transactionID, SENDER_WINS);
    }

    /** @notice Pays receiver if sender fails to pay the arbitration fee.
     *  @param _transactionID Id of the transaction.
     */
    function timeOutByReceiver(uint256 _transactionID) public {
        Transaction storage transaction = transactions[_transactionID];
        require(transaction.status == Status.WaitingSender, "The transaction is not waiting on the sender.");
        require(block.timestamp - transaction.lastInteraction >= feeTimeout, "Timeout time has not passed yet.");

        // Reimburse sender if has paid any fees.
        if (transaction.senderFee != 0) {
            uint256 senderFee = transaction.senderFee;
            transaction.senderFee = 0;
            payable(transaction.sender).transfer(senderFee);
        }

        _executeRuling(_transactionID, RECEIVER_WINS);
    }

    /** @notice Allows a party to submit a reference to evidence.
     *  @param _transactionID The index of the transaction.
     *  @param _evidence A link to an evidence using its URI.
     */
    function submitEvidence(uint256 _transactionID, string memory _evidence) public {
        Transaction storage transaction = transactions[_transactionID];
        require(
            msg.sender == transaction.sender || msg.sender == transaction.receiver,
            "The caller must be the sender or the receiver."
        );
        require(transaction.status < Status.Resolved, "Must not send evidence if the dispute is resolved.");

        emit Evidence(transaction.arbitrator, _transactionID, msg.sender, _evidence);
    }

    /**
     * @notice Allows a platform owner to claim its tokens & / or ETH balance.
     * @param _platformId The ID of the platform claiming the balance.
     * @param _tokenAddress The address of the Token contract (address(0) if balance in ETH).
     * Emits a BalanceTransferred event
     */
    function claim(uint256 _platformId, address _tokenAddress) external {
        address payable recipient;

        if (owner() == msg.sender) {
            require(_platformId == PROTOCOL_INDEX, "Access denied.");
            recipient = protocolWallet;
        } else {
            talentLayerPlatformIdContract.isValid(_platformId);
            recipient = payable(talentLayerPlatformIdContract.ownerOf(_platformId));
        }

        uint256 amount = platformIdToTokenToBalance[_platformId][_tokenAddress];
        platformIdToTokenToBalance[_platformId][_tokenAddress] = 0;
        _transferBalance(recipient, _tokenAddress, amount);

        emit FeesClaimed(_platformId, _tokenAddress, amount);
    }

    /**
     * @notice Allows the platform to claim all its tokens & / or ETH balances.
     * @param _platformId The ID of the platform claiming the balance.
     */
    function claimAll(uint256 _platformId) external {
        //TODO Copy Lugus (need to see how to handle approved token lists)
    }

    // =========================== Arbitrator functions ==============================

    /** @notice Allows the arbitrator to give a ruling for a dispute.
     *  @param _disputeID The ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function rule(uint256 _disputeID, uint256 _ruling) public {
        uint256 transactionID = disputeIDtoTransactionID[_disputeID];
        Transaction storage transaction = transactions[transactionID];

        require(msg.sender == address(transaction.arbitrator), "The caller must be the arbitrator.");
        require(transaction.status == Status.DisputeCreated, "The dispute has already been resolved.");

        emit Ruling(Arbitrator(msg.sender), _disputeID, _ruling);

        _executeRuling(transactionID, _ruling);
    }

    // =========================== Internal functions ==============================

    /** @notice Creates a dispute, paying the arbitration fee to the arbitrator. Parties are refund if
     *          they overpaid for the arbitration fee.
     *  @param _transactionID Id of the transaction.
     *  @param _arbitrationCost Amount to pay the arbitrator.
     */
    function _raiseDispute(uint256 _transactionID, uint256 _arbitrationCost) internal {
        Transaction storage transaction = transactions[_transactionID];
        transaction.status = Status.DisputeCreated;
        Arbitrator arbitrator = transaction.arbitrator;

        transaction.disputeId = arbitrator.createDispute{value: _arbitrationCost}(AMOUNT_OF_CHOICES, "");
        disputeIDtoTransactionID[transaction.disputeId] = _transactionID;
        emit Dispute(arbitrator, transaction.disputeId, _transactionID, _transactionID);

        // Refund sender if it overpaid.
        if (transaction.senderFee > _arbitrationCost) {
            uint256 extraFeeSender = transaction.senderFee - _arbitrationCost;
            transaction.senderFee = _arbitrationCost;
            payable(transaction.sender).transfer(extraFeeSender);
        }

        // Refund receiver if it overpaid.
        if (transaction.receiverFee > _arbitrationCost) {
            uint256 extraFeeReceiver = transaction.receiverFee - _arbitrationCost;
            transaction.receiverFee = _arbitrationCost;
            payable(transaction.receiver).transfer(extraFeeReceiver);
        }
    }

    /** @notice Executes a ruling of a dispute. Sends the funds and reimburses the arbitration fee to the winning party.
     *  @param _transactionID The index of the transaction.
     *  @param _ruling Ruling given by the arbitrator.
     *                 0: Refused to rule, split amount equally between sender and receiver.
     *                 1: Reimburse the sender
     *                 2: Pay the receiver
     */
    function _executeRuling(uint256 _transactionID, uint256 _ruling) internal {
        Transaction storage transaction = transactions[_transactionID];
        require(_ruling <= AMOUNT_OF_CHOICES, "Invalid ruling.");

        address payable sender = payable(transaction.sender);
        address payable receiver = payable(transaction.receiver);
        uint256 amount = transaction.amount;
        uint256 senderFee = transaction.senderFee;
        uint256 receiverFee = transaction.receiverFee;

        transaction.amount = 0;
        transaction.senderFee = 0;
        transaction.receiverFee = 0;
        transaction.status = Status.Resolved;

        // Send the funds to the winner and reimburse the arbitration fee.
        if (_ruling == SENDER_WINS) {
            sender.transfer(senderFee + amount);
        } else if (_ruling == RECEIVER_WINS) {
            receiver.transfer(receiverFee + amount);
        } else {
            // If no ruling is given split funds in half
            uint256 split_amount = (senderFee + amount) / 2;
            sender.transfer(split_amount);
            receiver.transfer(split_amount);
        }
    }

    // =========================== Private functions ==============================

    /**
     * @notice Called to record on chain all the information of a transaction in the 'transactions' array.
     * @param _sender The party paying the escrow amount
     * @param _receiver The intended receiver of the escrow amount
     * @param _token The token used for the transaction
     * @param _amount The amount of the transaction EXCLUDING FEES
     * @param _serviceId The ID of the associated service
     * @param _platformFee The %fee (per ten thousands) paid to the protocol's owner
     * @return The ID of the transaction
     */
    function _saveTransaction(
        address _sender,
        address _receiver,
        address _token,
        uint256 _amount,
        uint256 _serviceId,
        uint16 _platformFee,
        uint256 _timeoutPayment,
        Arbitrator _arbitrator
    ) private returns (uint256) {
        transactions.push(
            Transaction({
                sender: _sender,
                receiver: _receiver,
                token: _token,
                amount: _amount,
                serviceId: _serviceId,
                protocolFee: protocolFee,
                originPlatformFee: originPlatformFee,
                platformFee: _platformFee,
                timeoutPayment: _timeoutPayment,
                disputeId: 0,
                senderFee: 0,
                receiverFee: 0,
                lastInteraction: block.timestamp,
                status: Status.NoDispute,
                arbitrator: _arbitrator
            })
        );
        return transactions.length - 1;
    }

    /**
     * @notice Used to transfer ERC20 tokens balance from a wallet to the escrow contract's wallet.
     * @param _sender The wallet to transfer the tokens from
     * @param _token The token to transfer
     * @param _amount The amount of tokens to transfer
     */
    function _deposit(
        address _sender,
        address _token,
        uint256 _amount
    ) private {
        require(IERC20(_token).transferFrom(_sender, address(this), _amount), "Transfer must not fail");
    }

    /**
     * @notice Used to release part of the escrow payment to the seller.
     * @dev The release of an amount will also trigger the release of the fees to the platform's balances & the protocol fees.
     * @param _transaction The transaction to release the escrow value for
     * @param _releaseAmount The amount to release
     */
    function _release(Transaction memory _transaction, uint256 _releaseAmount) private {
        IServiceRegistry.Service memory service = serviceRegistryContract.getService(_transaction.serviceId);

        //Platform which onboarded the user
        uint256 originPlatformId = talentLayerIdContract.getOriginatorPlatformIdByAddress(_transaction.receiver);
        //Platform which originated the service
        uint256 platformId = service.platformId;
        uint256 protocolFeeAmount = (_transaction.protocolFee * _releaseAmount) / FEE_DIVIDER;
        uint256 originPlatformFeeAmount = (_transaction.originPlatformFee * _releaseAmount) / FEE_DIVIDER;
        uint256 platformFeeAmount = (_transaction.platformFee * _releaseAmount) / FEE_DIVIDER;

        //Index zero represents protocol's balance
        platformIdToTokenToBalance[0][_transaction.token] += protocolFeeAmount;
        platformIdToTokenToBalance[originPlatformId][_transaction.token] += originPlatformFeeAmount;
        platformIdToTokenToBalance[platformId][_transaction.token] += platformFeeAmount;

        if (_transaction.token == address(0)) {
            payable(_transaction.receiver).transfer(_releaseAmount);
        } else {
            require(
                IERC20(_transaction.token).transfer(_transaction.receiver, _releaseAmount),
                "Transfer must not fail"
            );
        }

        emit OriginPlatformFeeReleased(
            originPlatformId,
            _transaction.serviceId,
            _transaction.token,
            originPlatformFeeAmount
        );
        emit PlatformFeeReleased(platformId, _transaction.serviceId, _transaction.token, platformFeeAmount);
    }

    /**
     * @notice Used to reimburse part of the escrow payment to the buyer.
     * @dev If token payment, need token approval for the transfer of _releaseAmount before executing this function.
     *      The amount reimbursed must not include the fees, they will be automatically calculated and reimbursed to the buyer.
     * @param _transaction The transaction
     * @param _releaseAmount The amount to reimburse without fees
     */
    function _reimburse(Transaction memory _transaction, uint256 _releaseAmount) private {
        uint256 totalReleaseAmount = _releaseAmount +
            (((_transaction.protocolFee + _transaction.originPlatformFee + _transaction.platformFee) * _releaseAmount) /
                FEE_DIVIDER);

        if (_transaction.token == address(0)) {
            payable(_transaction.sender).transfer(totalReleaseAmount);
        } else {
            require(
                IERC20(_transaction.token).transfer(_transaction.sender, totalReleaseAmount),
                "Transfer must not fail"
            );
        }
    }

    /**
     * @notice Used to trigger "afterFullPayment" function & emit "PaymentCompleted" event if applicable.
     * @param _serviceId The id of the service
     * @param _amount The amount of the transaction
     */
    function _distributeMessage(uint256 _serviceId, uint256 _amount) private {
        if (_amount == 0) {
            serviceRegistryContract.afterFullPayment(_serviceId);
            emit PaymentCompleted(_serviceId);
        }
    }

    /**
     * @notice Used to retrieve data from ServiceRegistry & talentLayerId contracts.
     * @param _serviceId The id of the service
     * @param _proposalId The id of the proposal
     * @return proposal proposal struct, service The service struct, sender The sender address, receiver The receiver address
     */
    function _getTalentLayerData(uint256 _serviceId, uint256 _proposalId)
        private
        returns (
            IServiceRegistry.Proposal memory proposal,
            IServiceRegistry.Service memory service,
            address sender,
            address receiver
        )
    {
        IServiceRegistry.Proposal memory proposal = _getProposal(_serviceId, _proposalId);
        IServiceRegistry.Service memory service = _getService(_serviceId);
        address sender = talentLayerIdContract.ownerOf(service.buyerId);
        address receiver = talentLayerIdContract.ownerOf(proposal.sellerId);
        return (proposal, service, sender, receiver);
    }

    /**
     * @notice Used to get the Proposal data from the ServiceRegistry contract.
     * @param _serviceId The id of the service
     * @param _proposalId The id of the proposal
     * @return The Proposal struct
     */
    function _getProposal(uint256 _serviceId, uint256 _proposalId)
        private
        view
        returns (IServiceRegistry.Proposal memory)
    {
        return serviceRegistryContract.getProposal(_serviceId, _proposalId);
    }

    /**
     * @notice Used to get the Service data from the ServiceRegistry contract.
     * @param _serviceId The id of the service
     * @return The Service struct
     */
    function _getService(uint256 _serviceId) private view returns (IServiceRegistry.Service memory) {
        return serviceRegistryContract.getService(_serviceId);
    }

    /**
     * @notice Used to transfer the token or ETH balance from the escrow contract to a recipient's address.
     * @param _recipient The address to transfer the balance to
     * @param _tokenAddress The token address
     * @param _amount The amount to transfer
     */
    function _transferBalance(
        address payable _recipient,
        address _tokenAddress,
        uint256 _amount
    ) private {
        if (address(0) == _tokenAddress) {
            _recipient.transfer(_amount);
        } else {
            IERC20(_tokenAddress).transfer(_recipient, _amount);
        }
    }

    /**
     * @notice Utility function to calculate the total amount to be paid by the buyer to validate a proposal.
     * @param _amount The core escrow amount
     * @param _platformFee The platform fee
     * @return totalEscrowAmount The total amount to be paid by the buyer (including all fees + escrow) The amount to transfer
     */
    function _calculateTotalEscrowAmount(uint256 _amount, uint256 _platformFee)
        private
        view
        returns (uint256 totalEscrowAmount)
    {
        return
            _amount +
            (((_amount * protocolFee) + (_amount * originPlatformFee) + (_amount * _platformFee)) / FEE_DIVIDER);
    }
}
