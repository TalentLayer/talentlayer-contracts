pragma solidity ^0.8.0;

import "./interfaces/IPUSHCommInterface.sol";

contract TestNotificationSender {


    address constant public PUSH_COMM_CONTRACT = 0xb3971BCef2D791bc4027BbfedFb47319A4AAaaAa;

    address public talentLayerPushChannel = 0x9F89836C22f250595DEA30327af026bA1c029f28;

    /**
     / @notice PUSH protocol Notification contract
     */
    IPUSHCommInterface public pushCommContract;



    constructor() {
        // Goerli Address
        pushCommContract = IPUSHCommInterface(PUSH_COMM_CONTRACT);
    }

    function sendANotification(string calldata _serviceId) public {
        pushCommContract.sendNotification(talentLayerPushChannel, 0x4B3380d3A8C1AF85e47dBC1Fc6C3f4e0c8F78fEa,
            bytes(
                string(
                // We are passing identity here: https://docs.epns.io/developers/developer-guides/sending-notifications/advanced/notification-payload-types/identity/payload-identity-implementations
                    abi.encodePacked(
                        "0", // this is notification identity: https://docs.epns.io/developers/developer-guides/sending-notifications/advanced/notification-payload-types/identity/payload-identity-implementations
                        "+", // segregator
                        "3", // this is payload type: https://docs.epns.io/developers/developer-guides/sending-notifications/advanced/notification-payload-types/payload (1, 3 or 4) = (Broadcast, targetted or subset)
                        "+", // segregator
                        "Proposal ",
                        " Accepted", // this is notificaiton title
                        "+", // segregator
                        "Test Notification" // notification body
                    )
                )
            ));
    }
}
