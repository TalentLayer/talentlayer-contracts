// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Arbitrator.sol";

interface ITalentLayerEscrow {
    struct Transaction {
        address sender; //pays recipient using the escrow
        address receiver; //intended recipient of the escrow
        address token; //token of the escrow
        uint256 amount; //amount locked into escrow
        uint256 serviceId; //the serviceId related to the transaction
        uint16 protocolFee;
        uint16 originPlatformFee;
        uint16 platformFee;
    }

    function getClaimableFeeBalance(address _token) external view returns (uint256 balance);

    function getTransactionDetails(uint256 _transactionId) external view returns (Transaction memory);

    function updateProtocolFee(uint16 _protocolFee) external;

    function updateOriginPlatformFee(uint16 _originPlatformFee) external;

    function updateProtocolWallet(address payable _protocolWallet) external;

    function createTokenTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external;

    function createETHTransaction(
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external payable;

    function release(uint256 _transactionId, uint256 _amount) external;

    function reimburse(uint256 _transactionId, uint256 _amount) external;

    function claim(uint256 _platformId, address _tokenAddress) external;

    function claimAll(uint256 _platformId) external;
}
