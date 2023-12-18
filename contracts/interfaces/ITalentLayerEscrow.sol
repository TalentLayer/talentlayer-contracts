// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../Arbitrator.sol";

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerEscrow {
    // Enum declarations
    enum PaymentType {
        Release,
        Reimburse
    }
    enum ArbitrationFeePaymentType {
        Pay,
        Reimburse
    }
    enum Party {
        Sender,
        Receiver
    }
    enum Status {
        NoDispute, // no dispute has arisen about the transaction
        WaitingSender, // receiver has paid arbitration fee, while sender still has to do it
        WaitingReceiver, // sender has paid arbitration fee, while receiver still has to do it
        DisputeCreated, // both parties have paid the arbitration fee and a dispute has been created
        Resolved // the transaction is solved (either no dispute has ever arisen or the dispute has been resolved)
    }

    // Struct declarations
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

    // Function declarations
    function initialize(
        address _talentLayerServiceAddress,
        address _talentLayerIDAddress,
        address _talentLayerPlatformIDAddress,
        address _protocolWallet
    ) external;

    function getClaimableFeeBalance(address _token) external view returns (uint256 balance);

    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory);

    function updateProtocolEscrowFeeRate(uint16 _protocolEscrowFeeRate) external;

    function updateProtocolWallet(address payable _protocolWallet) external;

    function pause() external;

    function unpause() external;

    function createTransaction(
        uint256 _serviceId,
        uint256 _proposalId,
        string memory _metaEvidence,
        string memory _originDataUri
    ) external payable returns (uint256);

    function release(uint256 _profileId, uint256 _transactionId, uint256 _amount) external;

    function reimburse(uint256 _profileId, uint256 _transactionId, uint256 _amount) external;

    function payArbitrationFeeBySender(uint256 _transactionId) external payable;

    function payArbitrationFeeByReceiver(uint256 _transactionId) external payable;

    function arbitrationFeeTimeout(uint256 _transactionId) external;

    function submitEvidence(uint256 _profileId, uint256 _transactionId, string memory _evidence) external;

    function appeal(uint256 _transactionId) external payable;

    // Platform functions
    function claim(uint256 _platformId, address _tokenAddress) external;

    // Arbitrator functions
    function rule(uint256 _disputeID, uint256 _ruling) external;

    // Event declarations
    event Payment(
        uint256 _transactionId,
        PaymentType _paymentType,
        address _token,
        uint256 _amount,
        uint256 _serviceId,
        uint256 _proposalId
    );
    event PaymentCompleted(uint256 _serviceId);
    event ProtocolEscrowFeeRateUpdated(uint16 _protocolEscrowFeeRate);
    event FeesClaimed(uint256 _platformId, address indexed _token, uint256 _amount);
    event OriginServiceFeeRateReleased(
        uint256 _platformId,
        uint256 _serviceId,
        address indexed _token,
        uint256 _amount
    );
    event OriginValidatedProposalFeeRateReleased(
        uint256 _platformId,
        uint256 _serviceId,
        address indexed _token,
        uint256 _amount
    );
    event HasToPayFee(uint256 indexed _transactionId, Party _party);
    event ArbitrationFeePayment(
        uint256 indexed _transactionId,
        ArbitrationFeePaymentType _paymentType,
        Party _party,
        uint256 _amount
    );
    event RulingExecuted(uint256 indexed _transactionId, uint256 _ruling);
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
    event EvidenceSubmitted(uint256 indexed _transactionId, uint256 indexed _partyId, string _evidenceUri);
}
