// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILensHub} from "./ILensHub.sol";

contract MockLensHub is Ownable, ILensHub {
    // Mapping of user address to profile index to user token id
    mapping(address => mapping(uint256 => uint256)) public lensProfilesTokenId;

    /**
     * We add manually the users to the Lens Hub
     * @param _lensUsersAddress  Array of users address
     */
    function addLensProfileManually(address[] calldata _lensUsersAddress) external onlyOwner {
        //default value for profile index is 0
        uint256 profileIndex = 0;

        for (uint256 i = 1; i < _lensUsersAddress.length; i++) {
            lensProfilesTokenId[_lensUsersAddress[i]][profileIndex] = i;
        }
    }

    /**
     * @dev Returns a token ID owned by `owner` at a given `index` of its token list.
     * Use along with {balanceOf} to enumerate all of ``owner``'s tokens.
     */

    function tokenOfOwnerByIndex(address _lensUsersAddress, uint256 index) external view returns (uint256) {
        return lensProfilesTokenId[_lensUsersAddress][index];
    }
}
