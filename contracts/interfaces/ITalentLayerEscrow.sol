// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerEscrow {
    struct Transaction {
        uint256 id;
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 serviceId;
        uint16 protocolEscrowFeeRate;
        uint16 originServiceFeeRate;
        uint16 originValidatedProposalFeeRate;
        uint256 disputeId;
        uint256 senderFee;
        uint256 receiverFee;
        uint256 lastInteraction;
        Status status;
        //        Arbitrator arbitrator;
        bytes arbitratorExtraData;
        uint256 arbitrationFeeTimeout;
    }

    enum Status {
        NoDispute, // no dispute has arisen about the transaction
        WaitingSender, // receiver has paid arbitration fee, while sender still has to do it
        WaitingReceiver, // sender has paid arbitration fee, while receiver still has to do it
        DisputeCreated, // both parties have paid the arbitration fee and a dispute has been created
        Resolved // the transaction is solved (either no dispute has ever arisen or the dispute has been resolved)
    }

    function getClaimableFeeBalance(address _token) external view returns (uint256 balance);

    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory);

    function updateProtocolEscrowFeeRate(uint16 _protocolEscrowFeeRate) external;

    function updateProtocolWallet(address payable _protocolWallet) external;

    function createTransaction(
        uint256 _serviceId,
        uint256 _proposalId,
        string memory _metaEvidence,
        string memory originDataUri
    ) external payable returns (uint256);

    function release(uint256 _transactionId, uint256 _amount) external;

    function reimburse(uint256 _transactionId, uint256 _amount) external;

    function claim(uint256 _platformId, address _tokenAddress) external;

    function claimAll(uint256 _platformId) external;

    function payArbitrationFeeBySender(uint256 _transactionId) external payable;

    function payArbitrationFeeByReceiver(uint256 _transactionId) external payable;

    function timeOutBySender(uint256 _transactionId) external;

    function timeOutByReceiver(uint256 _transactionId) external;

    function submitEvidence(uint256 _transactionId, string memory _evidence) external;

    function appeal(uint256 _transactionId) external payable;

    function rule(uint256 _disputeID, uint256 _ruling) external;
}
