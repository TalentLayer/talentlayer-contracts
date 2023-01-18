// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IProofOfHumanity {
    function isRegistered(address _party) external view returns (bool, bytes memory);

    function addSubmissionManually(address[] calldata _submissionIDs) external;
}
