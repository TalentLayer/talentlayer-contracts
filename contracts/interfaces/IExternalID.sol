// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IExternalID {
    function isRegistered(address _user) external view returns (bool, bytes memory);
}
