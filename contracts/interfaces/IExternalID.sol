// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Concrete implementation of PartnershipContract for the Bloup platform

interface IExternalID {
    function isRegistered(address _user) external view returns (bool, bytes memory);
}
