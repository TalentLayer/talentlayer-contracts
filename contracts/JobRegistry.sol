// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract JobRegistry is Ownable {
    enum Status {
        Intialized, 
        Confirmed,
        Finished,
        Rejected
    }

    struct Job {
        Status status;
        uint256 employerId;
        uint256 employeeId;
        uint256 initiatorId;
        string jobDataUri;
    }

    event CreateJob(uint256 id, uint256 employerId, uint256 employeeId);

    uint256 nextJobId = 1;
    
    mapping(uint256 => Job) public jobs;

    function createJobFromEmployer(uint256 employeeId, string jobDataUri) public {
        require(walletOfOwner(msg.sender) != address(0));
        uint256 employerId = walletOfOwner(msg.sender);
        _createJob(initiatorId, employerId, employeeId, jobDataUri);       
    }

    function createJobFromEmployee(uint256 employerId, string jobDataUri) public {
        require(walletOfOwner(msg.sender) != address(0));
        uint256 employeeId = walletOfOwner(msg.sender);
        _createJob(initiatorId, employerId, employeeId, jobDataUri);       
    }

    function _createJob(uint256 initiatorId, uint256 employerId, uint256 employeeId, string jobDataUri) private {
        uint256 id = nextJobId;
        jobs[id] = Job({
            status: Status.Intialized,
            employerId: employerId,
            employeeId: employeeId,
            initiatorId: initiatorId,
            jobDataUri: jobDataUri
        });
        nextJobId++;
        emit CreateJob(id, employerId, employeeId);
    }

    function confirmJob(uint256 id) public {
        Job job = jobs[id];
        uint256 senderId = walletOfOwner(msg.sender);
        require(senderId != address(0));
        require(senderId != job.initiatorId);
        require(senderId == job.employerId || senderId == job.employeeId);
        job.status = Status.Confirmed;
    }

    function finishJob(uint256 id) public {
        Job job = jobs[id];
        uint256 senderId = walletOfOwner(msg.sender);
        require(senderId == job.employerId || senderId == job.employeeId);
        job.status = Status.Finished;
    }

    function rejectJob(uint256 id) public {
        Job job = jobs[id];
        uint256 senderId = walletOfOwner(msg.sender);
        require(senderId == job.employerId || senderId == job.employeeId);
        job.status = Status.Rejected;
    }
}
