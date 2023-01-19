// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IThirdPartyID.sol";
import "./IProofOfHumanity.sol";

contract ProofOfHumanityID is Ownable, IThirdPartyID {
   
    /**
     * @notice Instance of IProofOfHumanity
     */
    IProofOfHumanity private proofOfHumanity;

    
    constructor(address _address) {
        proofOfHumanity = IProofOfHumanity(_address);
    }
    

    function isRegistered(address _userAddress) external view returns (bool, bytes memory) {
  
        bool userIsRegistered = proofOfHumanity.isRegistered(_userAddress);

        if (userIsRegistered) {
            return (true, abi.encode(_userAddress));
        } else {
            return (false, bytes(""));
        }
    }
}
