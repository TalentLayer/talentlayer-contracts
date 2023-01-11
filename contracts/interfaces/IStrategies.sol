// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Concrete implementation of PartnershipContract for the Bloup platform

interface IStrategies {
    function isRegistered(address _user) external view;

    function getStratInfo(address _user) external view returns (bytes32);
}
