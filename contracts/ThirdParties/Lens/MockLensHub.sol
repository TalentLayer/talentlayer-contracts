// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILensHub} from "./ILensHub.sol";

contract MockLensHub is Ownable, ILensHub {
    struct LensProfile {
        uint256 userThirdPartyId;
    }

    mapping(address => LensProfile) public lensProfiles;

    /**
     * We add manually the users to the Lens Hub
     * @param _lensUsersAddress  Array of users address
     */
    function addLensProfileManually(address[] memory _lensUsersAddress) external onlyOwner {
        for (uint256 i = 0; i < _lensUsersAddress.length; i++) {
            lensProfiles[_lensUsersAddress[i]] = LensProfile(i);
        }
    }

    /**
     * We get the default profile of the user with the address
     * @param _lensUsersAddress  Address of the user
     */
    function defaultProfile(address _lensUsersAddress) external view returns (uint256) {
        return lensProfiles[_lensUsersAddress].userThirdPartyId;
    }
}
