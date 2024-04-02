// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {TalentLayerID} from "./TalentLayerID.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract TalentLayerIdUtils is IERC721Receiver {

    // =========================== Mappings & Variables ==============================

    /**
     * @notice Instance of TalentLayerID.sol
     */
    TalentLayerID public talentLayerIdContract;


    // =========================== Initializers ==============================

    constructor(address _talentLayerIDAddress){
        talentLayerIdContract = TalentLayerID(_talentLayerIDAddress);
    }

    // =========================== User functions ==============================

    function mintDelegateAndTransfer(address _to, address _delegateAddress, uint256 _platformId, string calldata _handle) external payable {
        // Mint TLID token
        uint256 tokenId = talentLayerIdContract.mint{value: msg.value}(_platformId, _handle);
        // Add address as delegate
        talentLayerIdContract.addDelegate(tokenId, _delegateAddress);
        // Transfer token to the user
        talentLayerIdContract.safeTransferFrom(address(this), _to, tokenId);
    }

    // =========================== Overrides ==============================

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

}
