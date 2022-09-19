// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

struct WalletFee {
    address wallet;
    uint fee;
}

/** @dev Create a transaction.
 *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
 *  @param _metaEvidence Link to the meta-evidence.
 *  @param _adminWallet Admin fee wallet.
 *  @param _adminFeeAmount Admin fee amount.
 *  @param _jobId Job of transaction
 *  @param _proposalId the proposal related to the transaction
 *  @return transactionID The index of the transaction.
 **/
interface IMultipleArbitrableTransaction {
    function createTransaction(
        uint _timeoutPayment,
        string memory _metaEvidence,
        address payable _adminWallet,
        uint _adminFeeAmount,
        uint256 _jobId,
        uint256 _proposalId
    ) public payable returns (uint transactionID);
}