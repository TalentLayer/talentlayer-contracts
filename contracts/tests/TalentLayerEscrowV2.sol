// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../interfaces/IServiceRegistry.sol";
import "../interfaces/ITalentLayerID.sol";
import "../interfaces/ITalentLayerPlatformID.sol";
import "../libs/ERC2771RecipientUpgradeable.sol";
import "../IArbitrable.sol";
import "../Arbitrator.sol";

contract TalentLayerEscrowV2 is Initializable, ERC2771RecipientUpgradeable, UUPSUpgradeable, IArbitrable {
    // =========================== Enum ==============================

    /**
     * @notice Enum payment type
     */
    enum PaymentType {
        Release,
        Reimburse
    }

    /**
     * @notice Arbitration fee payment type enum
     */
    enum ArbitrationFeePaymentType {
        Pay,
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
     * @param protocolEscrowFeeRate The %fee (per ten thousands) paid to the protocol's owner
     * @param originPlatformEscrowFeeRate The %fee (per ten thousands) paid to the platform who onboarded the user
     * @param platformEscrowFeeRate The %fee (per ten thousands) paid to the platform on which the transaction was created
     * @param disputeId The ID of the dispute, if it exists
     * @param senderFee Total fees paid by the sender.
     * @param receiverFee Total fees paid by the receiver.
     * @param lastInteraction Last interaction for the dispute procedure.
     * @param status The status of the transaction
     * @param arbitrator The address of the contract that can rule on a dispute for the transaction.
     * @param arbitratorExtraData Extra data to set up the arbitration.
     */
    struct Transaction {
        uint256 id;
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 serviceId;
        uint16 protocolEscrowFeeRate;
        uint16 originPlatformEscrowFeeRate;
        uint16 platformEscrowFeeRate;
        uint256 disputeId;
        uint256 senderFee;
        uint256 receiverFee;
        uint256 lastInteraction;
        Status status;
        Arbitrator arbitrator;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
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
     * @param _transactionId The id of the transaction.
     * @param _paymentType Whether the payment is a release or a reimbursement.
     * @param _amount The amount paid.
     * @param _token The address of the token used for the payment.
     * @param _serviceId The id of the concerned service.
     */
    event Payment(
        uint256 _transactionId,
        PaymentType _paymentType,
        uint256 _amount,
        address _token,
        uint256 _serviceId
    );

    /**
     * @notice Emitted after a service is finished
     * @param _serviceId The service ID
     */
    event PaymentCompleted(uint256 _serviceId);

    /**
     * @notice Emitted after the protocol fee was updated
     * @param _protocolEscrowFeeRate The new protocol fee
     */
    event ProtocolEscrowFeeRateUpdated(uint16 _protocolEscrowFeeRate);

    /**
     * @notice Emitted after the origin platform fee was updated
     * @param _originPlatformEscrowFeeRate The new origin platform fee
     */
    event OriginPlatformEscrowFeeRateUpdated(uint16 _originPlatformEscrowFeeRate);

    /**
     * @notice Emitted after a platform withdraws its balance
     * @param _platformId The Platform ID to which the balance is transferred.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount transferred.
     */
    event FeesClaimed(uint256 _platformId, address indexed _token, uint256 _amount);

    /**
     * @notice Emitted after an OriginPlatformFeeReleased is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event OriginPlatformFeeReleased(uint256 _platformId, uint256 _serviceId, address indexed _token, uint256 _amount);

    /**
     * @notice Emitted after a PlatformFeeReleased is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event PlatformFeeReleased(uint256 _platformId, uint256 _serviceId, address indexed _token, uint256 _amount);

    /** @notice Emitted when a party has to pay a fee for the dispute or would otherwise be considered as losing.
     *  @param _transactionId The id of the transaction.
     *  @param _party The party who has to pay.
     */
    event HasToPayFee(uint256 indexed _transactionId, Party _party);

    /** @notice Emitted when a party either pays the arbitration fee or gets it reimbursed.
     *  @param _transactionId The id of the transaction.
     *  @param _paymentType Whether the party paid or got reimbursed.
     *  @param _party The party who has paid/got reimbursed the fee.
     * @param _amount The amount paid/reimbursed
     */
    event ArbitrationFeePayment(
        uint256 indexed _transactionId,
        ArbitrationFeePaymentType _paymentType,
        Party _party,
        uint256 _amount
    );

    /**
     * @notice Emitted when a ruling is executed.
     * @param _transactionId The index of the transaction.
     * @param _ruling The given ruling.
     */
    event RulingExecuted(uint256 indexed _transactionId, uint256 _ruling);

    /** @notice Emitted when a transaction is created.
     *  @param _senderId The TL Id of the party paying the escrow amount
     *  @param _receiverId The TL Id of the intended receiver of the escrow amount
     *  @param _token The token used for the transaction
     *  @param _amount The amount of the transaction EXCLUDING FEES
     *  @param _serviceId The ID of the associated service
     *  @param _protocolEscrowFeeRate The %fee (per ten thousands) paid to the protocol's owner
     *  @param _originPlatformEscrowFeeRate The %fee (per ten thousands) paid to the platform who onboarded the user
     *  @param _platformEscrowFeeRate The %fee (per ten thousands) paid to the platform on which the transaction was created
     *  @param _arbitrator The address of the contract that can rule on a dispute for the transaction.
     *  @param _arbitratorExtraData Extra data to set up the arbitration.
     */
    event TransactionCreated(
        uint256 _transactionId,
        uint256 _senderId,
        uint256 _receiverId,
        address _token,
        uint256 _amount,
        uint256 _serviceId,
        uint16 _protocolEscrowFeeRate,
        uint16 _originPlatformEscrowFeeRate,
        uint16 _platformEscrowFeeRate,
        Arbitrator _arbitrator,
        bytes _arbitratorExtraData,
        uint256 _arbitrationFeeTimeout
    );

    /**
     * @notice Emitted when evidence is submitted.
     * @param _transactionId The id of the transaction.
     * @param _partyId The party submitting the evidence.
     * @param _evidenceUri The URI of the evidence.
     */
    event EvidenceSubmitted(uint256 indexed _transactionId, uint256 indexed _partyId, string _evidenceUri);

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
    uint16 public protocolEscrowFeeRate;

    /**
     * @notice Percentage paid to the platform who onboarded the user (per 10,000, upgradable)
     */
    uint16 public originPlatformEscrowFeeRate;

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
     * @notice One-to-one relationship between the dispute and the transaction.
     */
    mapping(uint256 => uint256) public disputeIDtoTransactionID;

    /**
     * @notice Test variable to test upgradeability.
     */
    uint256 private testVariable;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // =========================== Initializers ==============================

    /**
     * @dev Called on contract deployment
     * @param _serviceRegistryAddress Contract address to ServiceRegistry.sol
     * @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     * @param _talentLayerPlatformIDAddress Contract address to TalentLayerPlatformID.sol
     */
    function initialize(
        address _serviceRegistryAddress,
        address _talentLayerIDAddress,
        address _talentLayerPlatformIDAddress,
        address _protocolWallet
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        serviceRegistryContract = IServiceRegistry(_serviceRegistryAddress);
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIDAddress);
        protocolWallet = payable(_protocolWallet);

        updateProtocolEscrowFeeRate(100);
        updateOriginPlatformEscrowFeeRate(200);
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
        address sender = _msgSender();

        if (owner() == sender) {
            return platformIdToTokenToBalance[PROTOCOL_INDEX][_token];
        } else {
            uint256 platformId = talentLayerPlatformIdContract.getPlatformIdFromAddress(sender);
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

        address sender = _msgSender();
        require(
            sender == transaction.sender || sender == transaction.receiver,
            "You are not related to this transaction."
        );
        return transaction;
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Updated the Protocol Fee
     * @dev Only the owner can call this function
     * @param _protocolEscrowFeeRate The new protocol fee
     */
    function updateProtocolEscrowFeeRate(uint16 _protocolEscrowFeeRate) public onlyOwner {
        protocolEscrowFeeRate = _protocolEscrowFeeRate;
        emit ProtocolEscrowFeeRateUpdated(_protocolEscrowFeeRate);
    }

    /**
     * @notice Updated the Origin Platform Fee
     * @dev Only the owner can call this function
     * @param _originPlatformEscrowFeeRate The new origin platform fee
     */
    function updateOriginPlatformEscrowFeeRate(uint16 _originPlatformEscrowFeeRate) public onlyOwner {
        originPlatformEscrowFeeRate = _originPlatformEscrowFeeRate;
        emit OriginPlatformEscrowFeeRateUpdated(_originPlatformEscrowFeeRate);
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
     * @param _metaEvidence Link to the meta-evidence.
     * @param _serviceId Service of transaction
     * @param _serviceId Id of the service that the sender created and the proposal was made for.
     * @param _proposalId Id of the proposal that the transaction validates.
     */
    function createETHTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external payable returns (uint256) {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        ITalentLayerPlatformID.Platform memory platform = talentLayerPlatformIdContract.getPlatform(service.platformId);

        // PlatformEscrowFeeRate is per ten thousands
        uint256 transactionAmount = _calculateTotalEscrowAmount(proposal.rateAmount, platform.fee);
        require(_msgSender() == sender, "Access denied.");
        require(msg.value == transactionAmount, "Non-matching funds.");
        require(proposal.rateToken == address(0), "Proposal token not ETH.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(
            _serviceId,
            _proposalId,
            platform.fee,
            platform.arbitrator,
            platform.arbitratorExtraData,
            platform.arbitrationFeeTimeout
        );
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);
        _afterCreateTransaction(transactionId, _metaEvidence, proposal.sellerId);

        return transactionId;
    }

    /**
     * @dev Validates a proposal for a service by locking ERC20 into escrow.
     * @param _metaEvidence Link to the meta-evidence.
     * @param _serviceId Id of the service that the sender created and the proposal was made for.
     * @param _proposalId Id of the proposal that the transaction validates.
     */
    function createTokenTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external returns (uint256) {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        ITalentLayerPlatformID.Platform memory platform = talentLayerPlatformIdContract.getPlatform(service.platformId);

        // PlatformEscrowFeeRate is per ten thousands
        uint256 transactionAmount = _calculateTotalEscrowAmount(proposal.rateAmount, platform.fee);

        require(_msgSender() == sender, "Access denied.");
        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        uint256 transactionId = _saveTransaction(
            _serviceId,
            _proposalId,
            platform.fee,
            platform.arbitrator,
            platform.arbitratorExtraData,
            platform.arbitrationFeeTimeout
        );
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);
        _deposit(sender, proposal.rateToken, transactionAmount);
        _afterCreateTransaction(transactionId, _metaEvidence, proposal.sellerId);

        return transactionId;
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

        require(transaction.sender == _msgSender(), "Access denied.");
        require(transaction.status == Status.NoDispute, "The transaction shouldn't be disputed.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _release(transaction, _amount);
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

        require(transaction.receiver == _msgSender(), "Access denied.");
        require(transaction.status == Status.NoDispute, "The transaction shouldn't be disputed.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _reimburse(transaction, _amount);
    }

    /** @notice Allows the sender of the transaction to pay the arbitration fee to raise a dispute.
     *  Note that the arbitrator can have createDispute throw, which will make this function throw and therefore lead to a party being timed-out.
     *  This is not a vulnerability as the arbitrator can rule in favor of one party anyway.
     *  @param _transactionId Id of the transaction.
     */
    function payArbitrationFeeBySender(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set.");
        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(_msgSender() == transaction.sender, "The caller must be the sender.");

        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost(transaction.arbitratorExtraData);
        transaction.senderFee += msg.value;
        // The total fees paid by the sender should be at least the arbitration cost.
        require(transaction.senderFee == arbitrationCost, "The sender fee must be equal to the arbitration cost.");

        transaction.lastInteraction = block.timestamp;

        emit ArbitrationFeePayment(_transactionId, ArbitrationFeePaymentType.Pay, Party.Sender, msg.value);

        // The receiver still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.receiverFee < arbitrationCost) {
            transaction.status = Status.WaitingReceiver;
            emit HasToPayFee(_transactionId, Party.Receiver);
        } else {
            // The receiver has also paid the fee. We create the dispute.
            _raiseDispute(_transactionId, arbitrationCost);
        }
    }

    /** @notice Allows the receiver of the transaction to pay the arbitration fee to raise a dispute.
     *  Note that this function mirrors payArbitrationFeeBySender.
     *  @param _transactionId Id of the transaction.
     */
    function payArbitrationFeeByReceiver(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set.");
        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed."
        );
        require(_msgSender() == transaction.receiver, "The caller must be the receiver.");

        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost(transaction.arbitratorExtraData);
        transaction.receiverFee += msg.value;
        // The total fees paid by the receiver should be at least the arbitration cost.
        require(transaction.receiverFee == arbitrationCost, "The receiver fee must be equal to the arbitration cost.");

        transaction.lastInteraction = block.timestamp;

        emit ArbitrationFeePayment(_transactionId, ArbitrationFeePaymentType.Pay, Party.Receiver, msg.value);

        // The sender still has to pay. This can also happen if he has paid, but arbitrationCost has increased.
        if (transaction.senderFee < arbitrationCost) {
            transaction.status = Status.WaitingSender;
            emit HasToPayFee(_transactionId, Party.Sender);
        } else {
            // The sender has also paid the fee. We create the dispute.
            _raiseDispute(_transactionId, arbitrationCost);
        }
    }

    /** @notice Reimburses sender if receiver fails to pay the arbitration fee.
     *  @param _transactionId Id of the transaction.
     */
    function timeOutBySender(uint256 _transactionId) public {
        Transaction storage transaction = transactions[_transactionId];
        require(transaction.status == Status.WaitingReceiver, "The transaction is not waiting on the receiver.");
        require(
            block.timestamp - transaction.lastInteraction >= transaction.arbitrationFeeTimeout,
            "Timeout time has not passed yet."
        );

        // Reimburse receiver if has paid any fees.
        if (transaction.receiverFee != 0) {
            uint256 receiverFee = transaction.receiverFee;
            transaction.receiverFee = 0;
            payable(transaction.receiver).call{value: receiverFee}("");
        }

        _executeRuling(_transactionId, SENDER_WINS);
    }

    /** @notice Pays receiver if sender fails to pay the arbitration fee.
     *  @param _transactionId Id of the transaction.
     */
    function timeOutByReceiver(uint256 _transactionId) public {
        Transaction storage transaction = transactions[_transactionId];
        require(transaction.status == Status.WaitingSender, "The transaction is not waiting on the sender.");
        require(
            block.timestamp - transaction.lastInteraction >= transaction.arbitrationFeeTimeout,
            "Timeout time has not passed yet."
        );

        // Reimburse sender if has paid any fees.
        if (transaction.senderFee != 0) {
            uint256 senderFee = transaction.senderFee;
            transaction.senderFee = 0;
            payable(transaction.sender).call{value: senderFee}("");
        }

        _executeRuling(_transactionId, RECEIVER_WINS);
    }

    /** @notice Allows a party to submit a reference to evidence.
     *  @param _transactionId The index of the transaction.
     *  @param _evidence A link to an evidence using its URI.
     */
    function submitEvidence(uint256 _transactionId, string memory _evidence) public {
        address sender = _msgSender();
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set.");
        require(
            sender == transaction.sender || sender == transaction.receiver,
            "The caller must be the sender or the receiver."
        );
        require(transaction.status < Status.Resolved, "Must not send evidence if the dispute is resolved.");

        emit Evidence(transaction.arbitrator, _transactionId, sender, _evidence);

        uint256 party = talentLayerIdContract.walletOfOwner(sender);
        emit EvidenceSubmitted(_transactionId, party, _evidence);
    }

    /** @notice Appeals an appealable ruling, paying the appeal fee to the arbitrator.
     *  Note that no checks are required as the checks are done by the arbitrator.
     *
     *  @param _transactionId Id of the transaction.
     */
    function appeal(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set.");

        transaction.arbitrator.appeal{value: msg.value}(transaction.disputeId, transaction.arbitratorExtraData);
    }

    // =========================== Platform functions ==============================

    /**
     * @notice Allows a platform owner to claim its tokens & / or ETH balance.
     * @param _platformId The ID of the platform claiming the balance.
     * @param _tokenAddress The address of the Token contract (address(0) if balance in ETH).
     * Emits a BalanceTransferred event
     */
    function claim(uint256 _platformId, address _tokenAddress) external {
        address payable recipient;

        if (owner() == _msgSender()) {
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
        address sender = _msgSender();
        uint256 transactionId = disputeIDtoTransactionID[_disputeID];
        Transaction storage transaction = transactions[transactionId];

        require(sender == address(transaction.arbitrator), "The caller must be the arbitrator.");
        require(transaction.status == Status.DisputeCreated, "The dispute has already been resolved.");

        emit Ruling(Arbitrator(sender), _disputeID, _ruling);

        _executeRuling(transactionId, _ruling);
    }

    // =========================== Internal functions ==============================

    /** @notice Creates a dispute, paying the arbitration fee to the arbitrator. Parties are refund if
     *          they overpaid for the arbitration fee.
     *  @param _transactionId Id of the transaction.
     *  @param _arbitrationCost Amount to pay the arbitrator.
     */
    function _raiseDispute(uint256 _transactionId, uint256 _arbitrationCost) internal {
        Transaction storage transaction = transactions[_transactionId];
        transaction.status = Status.DisputeCreated;
        Arbitrator arbitrator = transaction.arbitrator;

        transaction.disputeId = arbitrator.createDispute{value: _arbitrationCost}(
            AMOUNT_OF_CHOICES,
            transaction.arbitratorExtraData
        );
        disputeIDtoTransactionID[transaction.disputeId] = _transactionId;
        emit Dispute(arbitrator, transaction.disputeId, _transactionId, _transactionId);

        // Refund sender if it overpaid.
        if (transaction.senderFee > _arbitrationCost) {
            uint256 extraFeeSender = transaction.senderFee - _arbitrationCost;
            transaction.senderFee = _arbitrationCost;
            payable(transaction.sender).call{value: extraFeeSender}("");
            emit ArbitrationFeePayment(_transactionId, ArbitrationFeePaymentType.Reimburse, Party.Sender, msg.value);
        }

        // Refund receiver if it overpaid.
        if (transaction.receiverFee > _arbitrationCost) {
            uint256 extraFeeReceiver = transaction.receiverFee - _arbitrationCost;
            transaction.receiverFee = _arbitrationCost;
            payable(transaction.receiver).call{value: extraFeeReceiver}("");
            emit ArbitrationFeePayment(_transactionId, ArbitrationFeePaymentType.Reimburse, Party.Receiver, msg.value);
        }
    }

    /** @notice Executes a ruling of a dispute. Sends the funds and reimburses the arbitration fee to the winning party.
     *  @param _transactionId The index of the transaction.
     *  @param _ruling Ruling given by the arbitrator.
     *                 0: Refused to rule, split amount equally between sender and receiver.
     *                 1: Reimburse the sender
     *                 2: Pay the receiver
     */
    function _executeRuling(uint256 _transactionId, uint256 _ruling) internal {
        Transaction storage transaction = transactions[_transactionId];
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
            sender.call{value: senderFee}("");
            _reimburse(transaction, amount);
        } else if (_ruling == RECEIVER_WINS) {
            receiver.call{value: receiverFee}("");
            _release(transaction, amount);
        } else {
            // If no ruling is given split funds in half
            uint256 splitFeeAmount = senderFee / 2;
            uint256 splitTransactionAmount = amount / 2;

            _reimburse(transaction, splitTransactionAmount);
            _release(transaction, splitTransactionAmount);

            sender.call{value: splitFeeAmount}("");
            receiver.call{value: splitFeeAmount}("");
        }

        emit RulingExecuted(_transactionId, _ruling);
    }

    /**
     * @notice Function that revert when `_msgSender()` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // =========================== Private functions ==============================

    /**
     * @notice Called to record on chain all the information of a transaction in the 'transactions' array.
     * @param _serviceId The ID of the associated service
     * @param _platformEscrowFeeRate The %fee (per ten thousands) paid to the protocol's owner
     * @return The ID of the transaction
     */
    function _saveTransaction(
        uint256 _serviceId,
        uint256 _proposalId,
        uint16 _platformEscrowFeeRate,
        Arbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        uint256 _arbitrationFeeTimeout
    ) internal returns (uint256) {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);

        uint256 id = transactions.length;

        transactions.push(
            Transaction({
                id: id,
                sender: sender,
                receiver: receiver,
                token: proposal.rateToken,
                amount: proposal.rateAmount,
                serviceId: _serviceId,
                protocolEscrowFeeRate: protocolEscrowFeeRate,
                originPlatformEscrowFeeRate: originPlatformEscrowFeeRate,
                platformEscrowFeeRate: _platformEscrowFeeRate,
                disputeId: 0,
                senderFee: 0,
                receiverFee: 0,
                lastInteraction: block.timestamp,
                status: Status.NoDispute,
                arbitrator: _arbitrator,
                arbitratorExtraData: _arbitratorExtraData,
                arbitrationFeeTimeout: _arbitrationFeeTimeout
            })
        );

        return id;
    }

    /**
     * @notice Emits the events related to the creation of a transaction.
     * @param _transactionId The ID of the transaction
     * @param _metaEvidence The meta evidence of the transaction
     * @param _sellerId The ID of the seller
     */
    function _afterCreateTransaction(uint256 _transactionId, string memory _metaEvidence, uint256 _sellerId) internal {
        Transaction storage transaction = transactions[_transactionId];

        uint256 sender = talentLayerIdContract.walletOfOwner(transaction.sender);
        uint256 receiver = talentLayerIdContract.walletOfOwner(transaction.receiver);

        emit TransactionCreated(
            _transactionId,
            sender,
            receiver,
            transaction.token,
            transaction.amount,
            transaction.serviceId,
            protocolEscrowFeeRate,
            originPlatformEscrowFeeRate,
            transaction.platformEscrowFeeRate,
            transaction.arbitrator,
            transaction.arbitratorExtraData,
            transaction.arbitrationFeeTimeout
        );
        emit MetaEvidence(_transactionId, _metaEvidence);
        emit ServiceProposalConfirmedWithDeposit(transaction.serviceId, _sellerId, _transactionId);
    }

    /**
     * @notice Used to transfer ERC20 tokens balance from a wallet to the escrow contract's wallet.
     * @param _sender The wallet to transfer the tokens from
     * @param _token The token to transfer
     * @param _amount The amount of tokens to transfer
     */
    function _deposit(address _sender, address _token, uint256 _amount) private {
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
        uint256 protocolEscrowFeeRateAmount = (_transaction.protocolEscrowFeeRate * _releaseAmount) / FEE_DIVIDER;
        uint256 originPlatformEscrowFeeRateAmount = (_transaction.originPlatformEscrowFeeRate * _releaseAmount) /
            FEE_DIVIDER;
        uint256 platformEscrowFeeRateAmount = (_transaction.platformEscrowFeeRate * _releaseAmount) / FEE_DIVIDER;

        //Index zero represents protocol's balance
        platformIdToTokenToBalance[0][_transaction.token] += protocolEscrowFeeRateAmount;
        platformIdToTokenToBalance[originPlatformId][_transaction.token] += originPlatformEscrowFeeRateAmount;
        platformIdToTokenToBalance[platformId][_transaction.token] += platformEscrowFeeRateAmount;

        _safeTransferBalance(payable(_transaction.receiver), _transaction.token, _releaseAmount);

        emit OriginPlatformFeeReleased(
            originPlatformId,
            _transaction.serviceId,
            _transaction.token,
            originPlatformEscrowFeeRateAmount
        );
        emit PlatformFeeReleased(platformId, _transaction.serviceId, _transaction.token, platformEscrowFeeRateAmount);
        emit Payment(_transaction.id, PaymentType.Release, _releaseAmount, _transaction.token, _transaction.serviceId);

        _distributeMessage(_transaction.serviceId, _transaction.amount);
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
            (((_transaction.protocolEscrowFeeRate +
                _transaction.originPlatformEscrowFeeRate +
                _transaction.platformEscrowFeeRate) * _releaseAmount) / FEE_DIVIDER);

        _safeTransferBalance(payable(_transaction.sender), _transaction.token, totalReleaseAmount);

        emit Payment(
            _transaction.id,
            PaymentType.Reimburse,
            _releaseAmount,
            _transaction.token,
            _transaction.serviceId
        );

        _distributeMessage(_transaction.serviceId, _transaction.amount);
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
    function _getTalentLayerData(
        uint256 _serviceId,
        uint256 _proposalId
    )
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
    function _getProposal(
        uint256 _serviceId,
        uint256 _proposalId
    ) private view returns (IServiceRegistry.Proposal memory) {
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
    function _transferBalance(address payable _recipient, address _tokenAddress, uint256 _amount) private {
        if (address(0) == _tokenAddress) {
            _recipient.transfer(_amount);
        } else {
            IERC20(_tokenAddress).transfer(_recipient, _amount);
        }
    }

    function _safeTransferBalance(address payable _recipient, address _tokenAddress, uint256 _amount) private {
        if (address(0) == _tokenAddress) {
            _recipient.call{value: _amount}("");
        } else {
            IERC20(_tokenAddress).transfer(_recipient, _amount);
        }
    }

    /**
     * @notice Utility function to calculate the total amount to be paid by the buyer to validate a proposal.
     * @param _amount The core escrow amount
     * @param _platformEscrowFeeRate The platform fee
     * @return totalEscrowAmount The total amount to be paid by the buyer (including all fees + escrow) The amount to transfer
     */
    function _calculateTotalEscrowAmount(
        uint256 _amount,
        uint256 _platformEscrowFeeRate
    ) private view returns (uint256 totalEscrowAmount) {
        return
            _amount +
            (((_amount * protocolEscrowFeeRate) +
                (_amount * originPlatformEscrowFeeRate) +
                (_amount * _platformEscrowFeeRate)) / FEE_DIVIDER);
    }
}
