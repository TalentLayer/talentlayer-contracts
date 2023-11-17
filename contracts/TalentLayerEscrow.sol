// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ITalentLayerService} from "./interfaces/ITalentLayerService.sol";
import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";
import "./libs/ERC2771RecipientUpgradeable.sol";
import {IArbitrable} from "./interfaces/IArbitrable.sol";
import {Arbitrator} from "./Arbitrator.sol";

/**
 * @title TalentLayer Escrow Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
contract TalentLayerEscrow is
    Initializable,
    ERC2771RecipientUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    IArbitrable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

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
     * @param id Incremental identifier
     * @param sender The party paying the escrow amount
     * @param receiver The intended receiver of the escrow amount
     * @param token The token used for the transaction
     * @param amount The amount of the transaction EXCLUDING FEES
     * @param releasedAmount The amount of the transaction that has been released to the receiver EXCLUDING FEES
     * @param serviceId The ID of the associated service
     * @param proposalId The id of the validated proposal
     * @param protocolEscrowFeeRate The %fee (per ten thousands) paid to the protocol's owner
     * @param originServiceFeeRate The %fee (per ten thousands) paid to the platform on which the service was created
     * @param originValidatedProposalFeeRate the %fee (per ten thousands) paid to the platform on which the proposal was validated
     * @param arbitrator The address of the contract that can rule on a dispute for the transaction.
     * @param status The status of the transaction for the dispute procedure.
     * @param disputeId The ID of the dispute, if it exists
     * @param senderFee Total fees paid by the sender for the dispute procedure.
     * @param receiverFee Total fees paid by the receiver for the dispute procedure.
     * @param lastInteraction Last interaction for the dispute procedure.
     * @param arbitratorExtraData Extra data to set up the arbitration.
     * @param arbitrationFeeTimeout timeout for parties to pay the arbitration fee
     */
    struct Transaction {
        uint256 id;
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 releasedAmount;
        uint256 serviceId;
        uint256 proposalId;
        uint16 protocolEscrowFeeRate;
        uint16 originServiceFeeRate;
        uint16 originValidatedProposalFeeRate;
        Arbitrator arbitrator;
        Status status;
        uint256 disputeId;
        uint256 senderFee;
        uint256 receiverFee;
        uint256 lastInteraction;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
    }

    // =========================== Events ==============================

    /**
     * @notice Emitted after each payment
     * @param _transactionId The id of the transaction.
     * @param _paymentType Whether the payment is a release or a reimbursement.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount paid.
     * @param _serviceId The id of the concerned service.
     */
    event Payment(
        uint256 _transactionId,
        PaymentType _paymentType,
        address _token,
        uint256 _amount,
        uint256 _serviceId
    );

    /**
     * @notice Emitted after the total amount of a transaction has been paid. At this moment the service is considered finished.
     * @param _serviceId The service ID
     */
    event PaymentCompleted(uint256 _serviceId);

    /**
     * @notice Emitted after the protocol fee was updated
     * @param _protocolEscrowFeeRate The new protocol fee
     */
    event ProtocolEscrowFeeRateUpdated(uint16 _protocolEscrowFeeRate);

    /**
     * @notice Emitted after a platform withdraws its balance
     * @param _platformId The Platform ID to which the balance is transferred.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount transferred.
     */
    event FeesClaimed(uint256 _platformId, address indexed _token, uint256 _amount);

    /**
     * @notice Emitted after an origin service fee is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event OriginServiceFeeRateReleased(
        uint256 _platformId,
        uint256 _serviceId,
        address indexed _token,
        uint256 _amount
    );

    /**
     * @notice Emitted after an origin service fee is released to a platform's balance
     * @param _platformId The platform ID.
     * @param _serviceId The related service ID.
     * @param _token The address of the token used for the payment.
     * @param _amount The amount released.
     */
    event OriginValidatedProposalFeeRateReleased(
        uint256 _platformId,
        uint256 _serviceId,
        address indexed _token,
        uint256 _amount
    );

    /**
     * @notice Emitted when a party has to pay a fee for the dispute or would otherwise be considered as losing.
     * @param _transactionId The id of the transaction.
     * @param _party The party who has to pay.
     */
    event HasToPayFee(uint256 indexed _transactionId, Party _party);

    /**
     * @notice Emitted when a party either pays the arbitration fee or gets it reimbursed.
     * @param _transactionId The id of the transaction.
     * @param _paymentType Whether the party paid or got reimbursed.
     * @param _party The party who has paid/got reimbursed the fee.
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

    /**
     * @notice Emitted when a transaction is created.
     * @param _transactionId Incremental idenfitifier
     * @param _senderId The TL Id of the party paying the escrow amount
     * @param _receiverId The TL Id of the intended receiver of the escrow amount
     * @param _token The token used for the transaction
     * @param _amount The amount of the transaction EXCLUDING FEES
     * @param _serviceId The ID of the associated service
     * @param _protocolEscrowFeeRate The %fee (per ten thousands) to pay to the protocol's owner
     * @param _originServiceFeeRate The %fee (per ten thousands) to pay to the platform on which the transaction was created
     * @param _originValidatedProposalFeeRate the %fee (per ten thousands) to pay to the platform on which the validated proposal was created
     * @param _arbitrator The address of the contract that can rule on a dispute for the transaction.
     * @param _arbitratorExtraData Extra data to set up the arbitration.
     * @param _arbitrationFeeTimeout timeout for parties to pay the arbitration fee
     */
    event TransactionCreated(
        uint256 _transactionId,
        uint256 _senderId,
        uint256 _receiverId,
        address _token,
        uint256 _amount,
        uint256 _serviceId,
        uint256 _proposalId,
        uint16 _protocolEscrowFeeRate,
        uint16 _originServiceFeeRate,
        uint16 _originValidatedProposalFeeRate,
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
     * @notice Mapping from transactionId to Transactions
     */
    mapping(uint256 => Transaction) private transactions;

    /**
     * @notice Mapping from platformId to Token address to Token Balance
     *         Represents the amount of ETH or token present on this contract which
     *         belongs to a platform and can be withdrawn.
     * @dev Id 0 (PROTOCOL_INDEX) is reserved to the protocol balance
     * @dev address(0) is reserved to ETH balance
     */
    mapping(uint256 => mapping(address => uint256)) private platformIdToTokenToBalance;

    /**
     * @notice Instance of TalentLayerService.sol
     */
    ITalentLayerService private talentLayerServiceContract;

    /**
     * @notice Instance of TalentLayerID.sol
     */
    ITalentLayerID private talentLayerIdContract;

    /**
     * @notice Instance of TalentLayerPlatformID.sol
     */
    ITalentLayerPlatformID private talentLayerPlatformIdContract;

    /**
     * @notice (Upgradable) Wallet which will receive the protocol fees
     */
    address payable public protocolWallet;

    /**
     * @notice Percentage paid to the protocol (per 10,000, upgradable)
     */
    uint16 public protocolEscrowFeeRate;

    /**
     * @notice The index of the protocol in the "platformIdToTokenToBalance" mapping
     */
    uint8 private constant PROTOCOL_INDEX = 0;

    /**
     * @notice The fee divider used for every fee rates
     */
    uint16 private constant FEE_DIVIDER = 10000;

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
     * @notice Platform Id counter
     */
    CountersUpgradeable.Counter private nextTransactionId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // =========================== Modifiers ==============================

    /**
     * @notice Check if the given address is either the owner or the delegate of the given user
     * @param _profileId The TalentLayer ID of the user
     */
    modifier onlyOwnerOrDelegate(uint256 _profileId) {
        require(talentLayerIdContract.isOwnerOrDelegate(_profileId, _msgSender()), "Not owner or delegate");
        _;
    }

    // =========================== Initializers ==============================

    /**
     * @dev Called on contract deployment
     * @param _talentLayerServiceAddress Contract address to TalentLayerService.sol
     * @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     * @param _talentLayerPlatformIDAddress Contract address to TalentLayerPlatformID.sol
     * @param _protocolWallet Wallet used to receive fees
     */
    function initialize(
        address _talentLayerServiceAddress,
        address _talentLayerIDAddress,
        address _talentLayerPlatformIDAddress,
        address _protocolWallet
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        talentLayerServiceContract = ITalentLayerService(_talentLayerServiceAddress);
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIDAddress);
        protocolWallet = payable(_protocolWallet);
        // Increment counter to start transaction ids at index 1
        nextTransactionId.increment();

        updateProtocolEscrowFeeRate(100);
    }

    // =========================== View functions ==============================

    /**
     * @dev Only the owner of the platform ID or the owner can execute this function
     * @param _token Token address ("0" for ETH)
     * @return balance The balance of the platform or the protocol
     */
    function getClaimableFeeBalance(address _token) external view returns (uint256 balance) {
        address sender = _msgSender();

        if (owner() == sender) {
            return platformIdToTokenToBalance[PROTOCOL_INDEX][_token];
        }
        uint256 platformId = talentLayerPlatformIdContract.ids(sender);
        talentLayerPlatformIdContract.isValid(platformId);
        return platformIdToTokenToBalance[platformId][_token];
    }

    /**
     * @notice Called to get the details of a transaction
     * @dev Only the transaction sender or receiver can call this function
     * @param _transactionId Id of the transaction
     * @return transaction The transaction details
     */
    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory) {
        Transaction memory transaction = transactions[_transactionId];
        require(transaction.id < nextTransactionId.current(), "Invalid transaction id");

        address sender = _msgSender();
        require(
            sender == transaction.sender || sender == transaction.receiver,
            "You are not related to this transaction"
        );
        return transaction;
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Updates the Protocol Fee rate
     * @dev Only the owner can call this function
     * @param _protocolEscrowFeeRate The new protocol fee
     */
    function updateProtocolEscrowFeeRate(uint16 _protocolEscrowFeeRate) public onlyOwner {
        protocolEscrowFeeRate = _protocolEscrowFeeRate;
        emit ProtocolEscrowFeeRateUpdated(_protocolEscrowFeeRate);
    }

    /**
     * @notice Updates the Protocol wallet that receive fees
     * @dev Only the owner can call this function
     * @param _protocolWallet The new wallet address
     */
    function updateProtocolWallet(address payable _protocolWallet) external onlyOwner {
        protocolWallet = _protocolWallet;
    }

    /**
     * @dev Pauses the creation of transaction, releases and reimbursements.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the creation of transaction, releases and reimbursements.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================== User functions ==============================

    /**
     * @dev Validates a proposal for a service by locking token into escrow.
     * @param _profileId Id of the user calling the function.
     * @param _serviceId Id of the service that the sender created and the proposal was made for.
     * @param _proposalId Id of the proposal that the transaction validates.
     * @param _metaEvidence Link to the meta-evidence.
     * @param _originDataUri dataURI of the validated proposal
     */
    function createTransaction(
        uint256 _profileId,
        uint256 _serviceId,
        uint256 _proposalId,
        string memory _metaEvidence,
        string memory _originDataUri
    ) external payable whenNotPaused onlyOwnerOrDelegate(_profileId) returns (uint256) {
        (
            ITalentLayerService.Service memory service,
            ITalentLayerService.Proposal memory proposal
        ) = talentLayerServiceContract.getServiceAndProposal(_serviceId, _proposalId);
        (address sender, address receiver) = talentLayerIdContract.ownersOf(service.ownerId, proposal.ownerId);

        ITalentLayerPlatformID.Platform memory originServiceCreationPlatform = talentLayerPlatformIdContract
            .getPlatform(service.platformId);
        ITalentLayerPlatformID.Platform memory originProposalCreationPlatform = service.platformId !=
            proposal.platformId
            ? talentLayerPlatformIdContract.getPlatform(proposal.platformId)
            : originServiceCreationPlatform;

        uint256 transactionAmount = _calculateTotalWithFees(
            proposal.rateAmount,
            originServiceCreationPlatform.originServiceFeeRate,
            originProposalCreationPlatform.originValidatedProposalFeeRate
        );

        if (proposal.rateToken == address(0)) {
            require(msg.value == transactionAmount, "Non-matching funds");
        } else {
            require(msg.value == 0, "Non-matching funds");
        }

        require(service.ownerId == _profileId, "Access denied");
        require(proposal.ownerId == _proposalId, "Incorrect proposal ID");
        require(proposal.expirationDate >= block.timestamp, "Proposal expired");
        require(service.status == ITalentLayerService.Status.Opened, "Service status not open");
        require(proposal.status == ITalentLayerService.ProposalStatus.Pending, "Proposal status not pending");
        require(bytes(_metaEvidence).length == 46, "Invalid cid");
        require(
            keccak256(abi.encodePacked(proposal.dataUri)) == keccak256(abi.encodePacked(_originDataUri)),
            "Proposal dataUri has changed"
        );

        uint256 transactionId = nextTransactionId.current();
        transactions[transactionId] = Transaction({
            id: transactionId,
            sender: sender,
            receiver: receiver,
            token: proposal.rateToken,
            amount: proposal.rateAmount,
            releasedAmount: 0,
            serviceId: _serviceId,
            proposalId: _proposalId,
            protocolEscrowFeeRate: protocolEscrowFeeRate,
            originServiceFeeRate: originServiceCreationPlatform.originServiceFeeRate,
            originValidatedProposalFeeRate: originProposalCreationPlatform.originValidatedProposalFeeRate,
            disputeId: 0,
            senderFee: 0,
            receiverFee: 0,
            lastInteraction: block.timestamp,
            status: Status.NoDispute,
            arbitrator: originServiceCreationPlatform.arbitrator,
            arbitratorExtraData: originServiceCreationPlatform.arbitratorExtraData,
            arbitrationFeeTimeout: originServiceCreationPlatform.arbitrationFeeTimeout
        });

        nextTransactionId.increment();

        talentLayerServiceContract.afterDeposit(_serviceId, _proposalId, transactionId);

        if (proposal.rateToken != address(0)) {
            IERC20Upgradeable(proposal.rateToken).safeTransferFrom(sender, address(this), transactionAmount);
        }

        _afterCreateTransaction(service.ownerId, proposal.ownerId, transactionId, _metaEvidence);

        return transactionId;
    }

    /**
     * @notice Allows the sender to release locked-in escrow value to the intended recipient.
     *         The amount released must not include the fees.
     * @param _profileId The TalentLayer ID of the user
     * @param _transactionId Id of the transaction to release escrow value for.
     * @param _amount Value to be released without fees. Should not be more than amount locked in.
     */
    function release(
        uint256 _profileId,
        uint256 _transactionId,
        uint256 _amount
    ) external whenNotPaused onlyOwnerOrDelegate(_profileId) {
        _validatePayment(_transactionId, PaymentType.Release, _profileId, _amount);

        Transaction storage transaction = transactions[_transactionId];
        transaction.amount -= _amount;
        transaction.releasedAmount += _amount;

        _release(_transactionId, _amount);
    }

    /**
     * @notice Allows the intended receiver to return locked-in escrow value back to the sender.
     *         The amount reimbursed must not include the fees.
     * @param _profileId The TalentLayer ID of the user
     * @param _transactionId Id of the transaction to reimburse escrow value for.
     * @param _amount Value to be reimbursed without fees. Should not be more than amount locked in.
     */
    function reimburse(
        uint256 _profileId,
        uint256 _transactionId,
        uint256 _amount
    ) external whenNotPaused onlyOwnerOrDelegate(_profileId) {
        _validatePayment(_transactionId, PaymentType.Reimburse, _profileId, _amount);

        Transaction storage transaction = transactions[_transactionId];
        transaction.amount -= _amount;

        _reimburse(_transactionId, _amount);
    }

    /**
     * @notice Allows the sender of the transaction to pay the arbitration fee to raise a dispute.
     * Note that the arbitrator can have createDispute throw, which will make this function throw and therefore lead to a party being timed-out.
     * This is not a vulnerability as the arbitrator can rule in favor of one party anyway.
     * @param _transactionId Id of the transaction.
     */
    function payArbitrationFeeBySender(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set");
        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed"
        );
        require(_msgSender() == transaction.sender, "The caller must be the sender");

        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost(transaction.arbitratorExtraData);
        transaction.senderFee += msg.value;
        // The total fees paid by the sender should be at least the arbitration cost.
        require(transaction.senderFee == arbitrationCost, "The sender fee must be equal to the arbitration cost");

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

    /**
     * @notice Allows the receiver of the transaction to pay the arbitration fee to raise a dispute.
     * Note that this function mirrors payArbitrationFeeBySender.
     * @param _transactionId Id of the transaction.
     */
    function payArbitrationFeeByReceiver(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set");
        require(
            transaction.status < Status.DisputeCreated,
            "Dispute has already been created or because the transaction has been executed"
        );
        require(_msgSender() == transaction.receiver, "The caller must be the receiver");

        uint256 arbitrationCost = transaction.arbitrator.arbitrationCost(transaction.arbitratorExtraData);
        transaction.receiverFee += msg.value;
        // The total fees paid by the receiver should be at least the arbitration cost.
        require(transaction.receiverFee == arbitrationCost, "The receiver fee must be equal to the arbitration cost");

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

    /**
     * @notice If one party fails to pay the arbitration fee in time, the other can call this function and will win the case
     * @param _transactionId Id of the transaction.
     */
    function arbitrationFeeTimeout(uint256 _transactionId) public {
        Transaction storage transaction = transactions[_transactionId];

        require(
            block.timestamp - transaction.lastInteraction >= transaction.arbitrationFeeTimeout,
            "Timeout time has not passed yet"
        );

        if (transaction.status == Status.WaitingSender) {
            if (transaction.senderFee != 0) {
                uint256 senderFee = transaction.senderFee;
                transaction.senderFee = 0;
                payable(transaction.sender).call{value: senderFee}("");
            }
            _executeRuling(_transactionId, RECEIVER_WINS);
        } else if (transaction.status == Status.WaitingReceiver) {
            if (transaction.receiverFee != 0) {
                uint256 receiverFee = transaction.receiverFee;
                transaction.receiverFee = 0;
                payable(transaction.receiver).call{value: receiverFee}("");
            }
            _executeRuling(_transactionId, SENDER_WINS);
        }
    }

    /**
     * @notice Allows a party to submit a reference to evidence.
     * @param _profileId The TalentLayer ID of the user
     * @param _transactionId The index of the transaction.
     * @param _evidence A link to an evidence using its URI.
     */
    function submitEvidence(
        uint256 _profileId,
        uint256 _transactionId,
        string memory _evidence
    ) public onlyOwnerOrDelegate(_profileId) {
        require(bytes(_evidence).length == 46, "Invalid cid");
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set");

        address party = talentLayerIdContract.ownerOf(_profileId);
        require(
            party == transaction.sender || party == transaction.receiver,
            "The caller must be the sender or the receiver or their delegates"
        );
        require(transaction.status < Status.Resolved, "Must not send evidence if the dispute is resolved");

        emit Evidence(transaction.arbitrator, _transactionId, party, _evidence);
        emit EvidenceSubmitted(_transactionId, _profileId, _evidence);
    }

    /**
     * @notice Appeals an appealable ruling, paying the appeal fee to the arbitrator.
     * Note that no checks are required as the checks are done by the arbitrator.
     *
     * @param _transactionId Id of the transaction.
     */
    function appeal(uint256 _transactionId) public payable {
        Transaction storage transaction = transactions[_transactionId];

        require(address(transaction.arbitrator) != address(0), "Arbitrator not set");

        transaction.arbitrator.appeal{value: msg.value}(transaction.disputeId, transaction.arbitratorExtraData);
    }

    // =========================== Platform functions ==============================

    /**
     * @notice Allows a platform owner to claim its tokens & / or ETH balance.
     * @param _platformId The ID of the platform claiming the balance.
     * @param _tokenAddress The address of the Token contract (address(0) if balance in ETH).
     * Emits a BalanceTransferred event
     */
    function claim(uint256 _platformId, address _tokenAddress) external whenNotPaused {
        address payable recipient;

        if (owner() == _msgSender()) {
            require(_platformId == PROTOCOL_INDEX, "Access denied");
            recipient = protocolWallet;
        } else {
            talentLayerPlatformIdContract.isValid(_platformId);
            recipient = payable(talentLayerPlatformIdContract.ownerOf(_platformId));
        }

        uint256 amount = platformIdToTokenToBalance[_platformId][_tokenAddress];
        require(amount > 0, "nothing to claim");
        platformIdToTokenToBalance[_platformId][_tokenAddress] = 0;
        _safeTransferBalance(recipient, _tokenAddress, amount);

        emit FeesClaimed(_platformId, _tokenAddress, amount);
    }

    // =========================== Arbitrator functions ==============================

    /**
     * @notice Allows the arbitrator to give a ruling for a dispute.
     * @param _disputeID The ID of the dispute in the Arbitrator contract.
     * @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function rule(uint256 _disputeID, uint256 _ruling) public {
        address sender = _msgSender();
        uint256 transactionId = disputeIDtoTransactionID[_disputeID];
        Transaction storage transaction = transactions[transactionId];

        require(sender == address(transaction.arbitrator), "The caller must be the arbitrator");
        require(transaction.status == Status.DisputeCreated, "The dispute has already been resolved");

        emit Ruling(Arbitrator(sender), _disputeID, _ruling);

        _executeRuling(transactionId, _ruling);
    }

    // =========================== Internal functions ==============================

    /**
     * @notice Creates a dispute, paying the arbitration fee to the arbitrator. Parties are refund if
     *         they overpaid for the arbitration fee.
     * @param _transactionId Id of the transaction.
     * @param _arbitrationCost Amount to pay the arbitrator.
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

    /**
     * @notice Executes a ruling of a dispute. Sends the funds and reimburses the arbitration fee to the winning party.
     * @param _transactionId The index of the transaction.
     * @param _ruling Ruling given by the arbitrator.
     *                0: Refused to rule, split amount equally between sender and receiver.
     *                1: Reimburse the sender
     *                2: Pay the receiver
     */
    function _executeRuling(uint256 _transactionId, uint256 _ruling) internal {
        Transaction storage transaction = transactions[_transactionId];
        require(_ruling <= AMOUNT_OF_CHOICES, "Invalid ruling");

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
            _reimburse(_transactionId, amount);
        } else if (_ruling == RECEIVER_WINS) {
            receiver.call{value: receiverFee}("");
            _release(_transactionId, amount);
        } else {
            // If no ruling is given split funds in half
            uint256 splitFeeAmount = senderFee / 2;
            uint256 splitTransactionAmount = amount / 2;

            _reimburse(_transactionId, splitTransactionAmount);
            _release(_transactionId, splitTransactionAmount);

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
     * @notice Emits the events related to the creation of a transaction.
     * @param _senderId The TL ID of the sender
     * @param _receiverId The TL ID of the receiver
     * @param _transactionId The ID of the transavtion
     * @param _metaEvidence The meta evidence of the transaction
     */
    function _afterCreateTransaction(
        uint256 _senderId,
        uint256 _receiverId,
        uint256 _transactionId,
        string memory _metaEvidence
    ) internal {
        Transaction storage transaction = transactions[_transactionId];

        emit TransactionCreated(
            _transactionId,
            _senderId,
            _receiverId,
            transaction.token,
            transaction.amount,
            transaction.serviceId,
            transaction.proposalId,
            protocolEscrowFeeRate,
            transaction.originServiceFeeRate,
            transaction.originValidatedProposalFeeRate,
            transaction.arbitrator,
            transaction.arbitratorExtraData,
            transaction.arbitrationFeeTimeout
        );
        emit MetaEvidence(_transactionId, _metaEvidence);
    }

    /**
     * @notice Used to release part of the escrow payment to the receiver.
     * @dev The release of an amount will also trigger the release of the fees to the platform's balances & the protocol fees.
     * @param _transactionId The transaction to release the escrow value for
     * @param _amount The amount to release
     */
    function _release(uint256 _transactionId, uint256 _amount) private {
        _distributeFees(_transactionId, _amount);

        Transaction storage transaction = transactions[_transactionId];
        _safeTransferBalance(payable(transaction.receiver), transaction.token, _amount);

        _afterPayment(_transactionId, PaymentType.Release, _amount);
    }

    /**
     * @notice Used to reimburse part of the escrow payment to the sender.
     * @dev Fees linked to the amount reimbursed will be automatically calculated and send back to the sender in the same transfer
     * @param _transactionId The transaction
     * @param _amount The amount to reimburse without fees
     */
    function _reimburse(uint256 _transactionId, uint256 _amount) private {
        Transaction storage transaction = transactions[_transactionId];
        uint256 totalReleaseAmount = _calculateTotalWithFees(
            _amount,
            transaction.originServiceFeeRate,
            transaction.originValidatedProposalFeeRate
        );
        _safeTransferBalance(payable(transaction.sender), transaction.token, totalReleaseAmount);

        _afterPayment(_transactionId, PaymentType.Reimburse, _amount);
    }

    /**
     * @notice Distribute fees to the platform's balances & the protocol after a fund release
     * @param _transactionId The transaction linked to the payment
     * @param _releaseAmount The amount released
     */
    function _distributeFees(uint256 _transactionId, uint256 _releaseAmount) private {
        Transaction storage transaction = transactions[_transactionId];
        (
            ITalentLayerService.Service memory service,
            ITalentLayerService.Proposal memory proposal
        ) = talentLayerServiceContract.getServiceAndProposal(transaction.serviceId, transaction.proposalId);

        uint256 originServiceCreationPlatformId = service.platformId;
        uint256 originValidatedProposalPlatformId = proposal.platformId;

        uint256 protocolEscrowFeeRateAmount = (transaction.protocolEscrowFeeRate * _releaseAmount) / FEE_DIVIDER;
        uint256 originServiceFeeRate = (transaction.originServiceFeeRate * _releaseAmount) / FEE_DIVIDER;
        uint256 originValidatedProposalFeeRate = (transaction.originValidatedProposalFeeRate * _releaseAmount) /
            FEE_DIVIDER;

        platformIdToTokenToBalance[PROTOCOL_INDEX][transaction.token] += protocolEscrowFeeRateAmount;
        platformIdToTokenToBalance[originServiceCreationPlatformId][transaction.token] += originServiceFeeRate;
        platformIdToTokenToBalance[originValidatedProposalPlatformId][
            transaction.token
        ] += originValidatedProposalFeeRate;

        emit OriginServiceFeeRateReleased(
            originServiceCreationPlatformId,
            transaction.serviceId,
            transaction.token,
            originServiceFeeRate
        );
        emit OriginValidatedProposalFeeRateReleased(
            originValidatedProposalPlatformId,
            transaction.serviceId,
            transaction.token,
            originServiceFeeRate
        );
    }

    /**
     * @notice Used to validate a realease or a reimburse payment
     * @param _transactionId The transaction linked to the payment
     * @param _paymentType The type of payment to validate
     * @param _profileId The profileId of the msgSender
     * @param _amount The amount to release
     */
    function _validatePayment(
        uint256 _transactionId,
        PaymentType _paymentType,
        uint256 _profileId,
        uint256 _amount
    ) private view {
        Transaction storage _transaction = transactions[_transactionId];
        if (_paymentType == PaymentType.Release) {
            require(_transaction.sender == talentLayerIdContract.ownerOf(_profileId), "Access denied");
        } else if (_paymentType == PaymentType.Reimburse) {
            require(_transaction.receiver == talentLayerIdContract.ownerOf(_profileId), "Access denied");
        }

        require(_transaction.id < nextTransactionId.current(), "Invalid transaction id");
        require(_transaction.status == Status.NoDispute, "The transaction shouldn't be disputed");
        require(_transaction.amount >= _amount, "Insufficient funds");
        require(_amount >= FEE_DIVIDER || (_amount < FEE_DIVIDER && _amount == _transaction.amount), "Amount too low");
    }

    /**
     * @notice Used to trigger events after a payment and to complete a service when the payment is full
     * @param _transactionId The transaction linked to the payment
     * @param _paymentType The type of the payment
     * @param _releaseAmount The amount of the transaction
     */
    function _afterPayment(uint256 _transactionId, PaymentType _paymentType, uint256 _releaseAmount) private {
        Transaction storage transaction = transactions[_transactionId];
        emit Payment(transaction.id, _paymentType, transaction.token, _releaseAmount, transaction.serviceId);

        if (transaction.amount == 0) {
            talentLayerServiceContract.afterFullPayment(transaction.serviceId, transaction.releasedAmount);
            emit PaymentCompleted(transaction.serviceId);
        }
    }

    /**
     * @notice Used to transfer the token or ETH balance from the escrow contract to a recipient's address.
     * @param _recipient The address to transfer the balance to
     * @param _tokenAddress The token address
     * @param _amount The amount to transfer
     */
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
     * @param _originServiceFeeRate the %fee (per ten thousands) asked by the platform for each service created on the platform
     * @param _originValidatedProposalFeeRate the %fee (per ten thousands) asked by the platform for each validates service on the platform
     * @return totalEscrowAmount The total amount to be paid by the buyer (including all fees + escrow) The amount to transfer
     */
    function _calculateTotalWithFees(
        uint256 _amount,
        uint16 _originServiceFeeRate,
        uint16 _originValidatedProposalFeeRate
    ) private view returns (uint256 totalEscrowAmount) {
        return
            _amount +
            (((_amount * protocolEscrowFeeRate) +
                (_amount * _originServiceFeeRate) +
                (_amount * _originValidatedProposalFeeRate)) / FEE_DIVIDER);
    }

    // =========================== Overrides ==============================

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (address)
    {
        return ERC2771RecipientUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771RecipientUpgradeable._msgData();
    }
}
