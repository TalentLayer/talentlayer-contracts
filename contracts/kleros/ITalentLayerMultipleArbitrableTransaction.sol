// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITalentLayerMultipleArbitrableTransaction{
	struct Transaction {
	    address sender;
	    address receiver;
	    address token;
	    uint256 amount;
	}

	function createTokenTransaction(
	    uint256 _jobId,
	    uint256 _proposalId
	) external;


	function release(
	    uint256 _transactionId,
	    uint256 _amount
	) external;

	function reimburse(
	    uint256 _transactionId,
	    uint256 _amount
	) external;
}