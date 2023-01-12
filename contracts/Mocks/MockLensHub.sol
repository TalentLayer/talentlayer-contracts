// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockLensHub is Ownable {
    struct LensProfile {
        bool isRegistered;
        bytes userExternalId;
    }

    mapping(address => LensProfile) public lensProfiles;

    function addLensProfileManually(address[] calldata _lensUSerAddress) external onlyOwner {
        for (uint256 i = 0; i < _lensUSerAddress.length; i++) {
            lensProfiles[_lensUSerAddress[i]] = LensProfile(true, abi.encode(_lensUSerAddress[i]));
        }
    }

    function defaultProfile(address wallet) external view returns (LensProfile memory) {
        return lensProfiles[wallet];
    }
}
