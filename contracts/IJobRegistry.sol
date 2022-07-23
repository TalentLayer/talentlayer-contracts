// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IJobRegistry {
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

    function getJob(uint256 _jobId) external view returns (Job memory);
}
