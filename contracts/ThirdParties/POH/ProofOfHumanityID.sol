// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./IProofOfHumanity.sol";

contract ProofOfHumanityID is Ownable {
   
    /**
     * @notice Instance of IProofOfHumanity
     */
    IProofOfHumanity private iProofOfHumanity;
    

    function isRegistered(address _submissionID) external view returns (bool, bytes memory) {
       
        bool isRegistered = submission.registered && block.timestamp - submission.submissionTime <= submissionDuration;
        bytes memory _submissionIDBytes = abi.encode(_submissionID);
        return (isRegistered, _submissionIDBytes);
    }
}
