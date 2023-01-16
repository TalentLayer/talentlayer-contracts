// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IThirdPartyID {
    function isRegistered(address _user) external view returns (bool, bytes memory);
}
