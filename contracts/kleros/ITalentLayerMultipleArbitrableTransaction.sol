// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

struct WalletFee {
    address wallet;
    uint fee;
}

interface IMultipleArbitrableTransaction {
    function createTransaction(
        uint _timeoutPayment,
        string memory _metaEvidence,
        address payable _adminWallet,
        uint _adminFeeAmount,
        uint256 _jobId,
        uint256 _proposalId
    ) external payable returns (uint transactionID);
}