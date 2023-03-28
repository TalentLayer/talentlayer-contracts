// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Arbitrator, IArbitrable} from "./Arbitrator.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";

/**
 * @title TalentLayer Arbitrator
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer <labs@talentlayer.org> | Website: https://talentlayer.com | Twitter: @talentlayer
 */
contract TalentLayerArbitrator is Arbitrator {
    uint256 constant NOT_PAYABLE_VALUE = (2 ** 256 - 2) / 2; // High value to be sure that the appeal is too expensive.

    /**
     * @notice Instance of TalentLayerPlatformID.sol
     */
    ITalentLayerPlatformID private talentLayerPlatformIdContract;

    /**
     * @notice Mapping from platformId to arbitration price
     */
    mapping(uint256 => uint256) public arbitrationPrice;

    /**
     * @notice Dispute struct
     * @param arbitrated The contract that created the dispute.
     * @param choices Amount of choices the arbitrator can make in the dispute.
     * @param fee Arbitration fee that has been paid for the dispute.
     * @param ruling Current ruling of the dispute.
     * @param platformId Id of the platform where the dispute was created.
     * @param status Status of the dispute.
     */
    struct Dispute {
        IArbitrable arbitrated;
        uint256 choices;
        uint256 fee;
        uint256 ruling;
        uint256 platformId;
        DisputeStatus status;
    }

    Dispute[] public disputes;

    /**
     * @dev Constructor. Set the initial arbitration price.
     * @param _talentLayerPlatformIDAddress Contract address to TalentLayerPlatformID.sol
     */
    constructor(address _talentLayerPlatformIDAddress) {
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIDAddress);
    }

    /**
     * @dev Set the arbitration price. Only callable by the owner.
     * @param _platformId Id of the platform to set the arbitration price for.
     * @param _arbitrationPrice Amount to be paid for arbitration.
     */
    function setArbitrationPrice(uint256 _platformId, uint256 _arbitrationPrice) public {
        require(
            msg.sender == talentLayerPlatformIdContract.ownerOf(_platformId),
            "You're not the owner of the platform"
        );

        arbitrationPrice[_platformId] = _arbitrationPrice;
    }

    /**
     * @dev Cost of arbitration. Accessor to arbitrationPrice.
     * @param _extraData Should be the id of the platform.
     * @return fee Amount to be paid.
     */
    function arbitrationCost(bytes memory _extraData) public view override returns (uint256 fee) {
        uint256 platformId = bytesToUint(_extraData);
        return arbitrationPrice[platformId];
    }

    /**
     * @dev Cost of appeal. Since it is not possible, it's a high value which can never be paid.
     * @return fee Amount to be paid.
     */
    function appealCost(
        uint256 /*_disputeID*/,
        bytes memory /*_extraData*/
    ) public pure override returns (uint256 fee) {
        return NOT_PAYABLE_VALUE;
    }

    /**
     * @dev Create a dispute. Must be called by the arbitrable contract.
     * Must be paid at least arbitrationCost().
     * @param _choices Amount of choices the arbitrator can make in this dispute. When ruling ruling<=choices.
     * @param _extraData Should be the id of the platform where the dispute is arising.
     * @return disputeID ID of the dispute created.
     */
    function createDispute(
        uint256 _choices,
        bytes memory _extraData
    ) public payable override returns (uint256 disputeID) {
        super.createDispute(_choices, _extraData);
        uint256 platformId = bytesToUint(_extraData);

        disputes.push(
            Dispute({
                arbitrated: IArbitrable(msg.sender),
                choices: _choices,
                fee: msg.value,
                ruling: 0,
                status: DisputeStatus.Waiting,
                platformId: platformId
            })
        );
        disputeID = disputes.length - 1; // Create the dispute and return its number.
        emit DisputeCreation(disputeID, IArbitrable(msg.sender));
    }

    /**
     * @dev Give a ruling. UNTRUSTED.
     * @param _disputeID ID of the dispute to rule.
     * @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
     */
    function giveRuling(uint256 _disputeID, uint256 _ruling) public {
        Dispute storage dispute = disputes[_disputeID];

        require(
            msg.sender == talentLayerPlatformIdContract.ownerOf(dispute.platformId),
            "You're not the owner of the platform"
        );

        require(_ruling <= dispute.choices, "Invalid ruling.");
        require(dispute.status != DisputeStatus.Solved, "The dispute must not be solved already.");

        dispute.ruling = _ruling;
        dispute.status = DisputeStatus.Solved;

        payable(msg.sender).call{value: dispute.fee}("");

        dispute.arbitrated.rule(_disputeID, _ruling);
    }

    /**
     * @dev Return the status of a dispute.
     * @param _disputeID ID of the dispute to rule.
     * @return status The status of the dispute.
     */
    function disputeStatus(uint256 _disputeID) public view override returns (DisputeStatus status) {
        return disputes[_disputeID].status;
    }

    /**
     * @dev Return the ruling of a dispute.
     * @param _disputeID ID of the dispute to rule.
     * @return ruling The ruling which would or has been given.
     */
    function currentRuling(uint256 _disputeID) public view override returns (uint256 ruling) {
        return disputes[_disputeID].ruling;
    }

    /**
     * @dev Converts bytes to uint256
     */
    function bytesToUint(bytes memory bs) private pure returns (uint256) {
        require(bs.length >= 32, "slicing out of range");
        uint256 x;
        assembly {
            x := mload(add(bs, add(0x20, 0)))
        }
        return x;
    }
}
