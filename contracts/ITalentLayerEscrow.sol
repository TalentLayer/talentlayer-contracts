// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITalentLayerEscrow {
    struct Transaction {
        address sender; //pays recipient using the escrow
        address receiver; //intended recipient of the escrow
        address token; //token of the escrow
        uint256 amount; //amount locked into escrow
        uint256 serviceId; //the serviceId related to the transaction
        uint16 protocolEscrowFeeRate;
        uint16 originPlatformEscrowFeeRate;
        uint16 platformEscrowFeeRate;
    }

    function getClaimableFeeBalance(address _token) external view returns (uint256 balance);

    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory);

    function updateProtocolEscrowFeeRate(uint16 _protocolEscrowFeeRate) external;

    function updateOriginPlatformEscrowFeeRate(uint16 _originPlatformEscrowFeeRate) external;

    function updateProtocolWallet(address payable _protocolWallet) external;

    function createTokenTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external returns (uint256);

    function createETHTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external payable returns (uint256);

    function release(uint256 _transactionId, uint256 _amount) external;

    function reimburse(uint256 _transactionId, uint256 _amount) external;

    function claim(uint256 _platformId, address _tokenAddress) external;

    function claimAll(uint256 _platformId) external;
}
