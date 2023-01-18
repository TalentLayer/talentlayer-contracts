// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockProofOfHumanity is Ownable {
    enum Status {
        None,
        Vouching,
        PendingRegistration,
        PendingRemoval
    }

    mapping(address => Submission) private submissions;
    uint64 public submissionDuration;

    struct Submission {
        Status status;
        bool registered;
        bool hasVouched;
        uint64 submissionTime;
        uint64 index;
    }

    constructor() {
        submissionDuration = 604800;
    }

    function addSubmissionManually(address[] calldata _submissionIDs) external onlyOwner {
        for (uint256 i = 0; i < _submissionIDs.length; i++) {
            submissions[_submissionIDs[i]] = Submission(Status.None, true, true, uint64(block.timestamp), 420);
        }
    }

    function isRegistered(address _submissionID) external view returns (bool, bytes memory) {
        Submission storage submission = submissions[_submissionID];
        bool isRegistered = submission.registered && block.timestamp - submission.submissionTime <= submissionDuration;
        bytes memory _submissionIDBytes = abi.encode(_submissionID);
        return (isRegistered, _submissionIDBytes);
    }
}
