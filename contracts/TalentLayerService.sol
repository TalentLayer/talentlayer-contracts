// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";
import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

/**
 * @title TalentLayerService Contract
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
contract TalentLayerService is Initializable, ERC2771RecipientUpgradeable, UUPSUpgradeable, AccessControlUpgradeable {
    // =========================== Enum ==============================

    /**
     * @notice Enum service status
     */
    enum Status {
        Opened,
        Confirmed,
        Finished,
        Cancelled,
        Uncompleted
    }

    /**
     * @notice Enum proposal status
     */
    enum ProposalStatus {
        Pending,
        Validated
    }

    // =========================== Struct ==============================

    /**
     * @notice Service information struct
     * @param status the current status of a service
     * @param ownerId the talentLayerId of the buyer
     * @param acceptedProposalId the accepted proposal ID
     * @param dataUri token Id to IPFS URI mapping
     * @param transactionId the escrow transaction ID linked to the service
     * @param platformId the platform ID on which the service was created
     */
    struct Service {
        Status status;
        uint256 ownerId;
        uint256 acceptedProposalId;
        string dataUri;
        uint256 transactionId;
        uint256 platformId;
    }

    /**
     * @notice Proposal information struct
     * @param status the current status of a service
     * @param ownerId the talentLayerId of the seller
     * @param rateToken the token choose for the payment
     * @param rateAmount the amount of token chosen
     * @param dataUri token Id to IPFS URI mapping
     * @param expirationDate the timeout for the proposal
     */
    struct Proposal {
        ProposalStatus status;
        uint256 ownerId;
        address rateToken;
        uint256 rateAmount;
        uint256 platformId;
        string dataUri;
        uint256 expirationDate;
    }

    /**
     * @notice Whitelisted token information struct
     * @param tokenAddress the token address
     * @param minimumTransactionAmount the minimum transaction value
     */
    struct AllowedToken {
        bool isWhitelisted;
        uint256 minimumTransactionAmount;
    }

    // =========================== Events ==============================

    /**
     * @notice Emitted after a new service is created
     * @param id The service ID (incremental)
     * @param ownerId the talentLayerId of the buyer
     * @param platformId platform ID on which the Service token was minted
     * @param dataUri token Id to IPFS URI mapping
     */
    event ServiceCreated(uint256 id, uint256 ownerId, uint256 platformId, string dataUri);

    /**
     * @notice Emitted after a service is cancelled by the owner
     * @param id The service ID
     */
    event ServiceCancelled(uint256 id);

    /**
     * @notice Emit when Cid is updated for a Service
     * @param id The service ID
     * @param dataUri New service Data URI
     */
    event ServiceDetailedUpdated(uint256 indexed id, string dataUri);

    /**
     * @notice Emitted after a new proposal is created
     * @param serviceId The service id
     * @param ownerId The talentLayerId of the seller who made the proposal
     * @param dataUri token Id to IPFS URI mapping
     * @param status proposal status
     * @param rateToken the token choose for the payment
     * @param rateAmount the amount of token chosen
     * @param platformId the platform ID on which the proposal was created
     * @param expirationDate the timeout for the proposal
     */
    event ProposalCreated(
        uint256 serviceId,
        uint256 ownerId,
        string dataUri,
        ProposalStatus status,
        address rateToken,
        uint256 rateAmount,
        uint256 platformId,
        uint256 expirationDate
    );

    /**
     * @notice Emitted after an existing proposal has been updated
     * @param serviceId The service id
     * @param ownerId The talentLayerId of the seller who made the proposal
     * @param dataUri token Id to IPFS URI mapping
     * @param rateToken the token choose for the payment
     * @param rateAmount the amount of token chosen
     * @param expirationDate the timeout for the proposal
     */
    event ProposalUpdated(
        uint256 serviceId,
        uint256 ownerId,
        string dataUri,
        address rateToken,
        uint256 rateAmount,
        uint256 expirationDate
    );

    /**
     * @notice Emitted when the contract owner adds or removes a token from the allowed payment tokens list
     * @param tokenAddress The address of the payment token
     * @param isWhitelisted Whether the token is allowed or not
     * @param minimumTransactionAmount The minimum transaction fees for the token
     */
    event AllowedTokenListUpdated(address tokenAddress, bool isWhitelisted, uint256 minimumTransactionAmount);

    /**
     * @notice Emitted when the contract owner updates the minimum completion percentage for services
     * @param minCompletionPercentage The new minimum completion percentage
     */
    event MinCompletionPercentageUpdated(uint256 minCompletionPercentage);

    // =========================== Mappings & Variables ==============================

    /**
     * @notice incremental service Id
     */
    uint256 public nextServiceId;

    /**
     * @notice TalentLayerId address
     */
    ITalentLayerID private tlId;

    /**
     * @notice TalentLayer Platform ID registry contract
     */
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    /**
     * @notice services mappings index by ID
     */
    mapping(uint256 => Service) public services;

    /**
     * @notice proposals mappings index by service ID and owner TID
     */
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals;

    /**
     * @notice TLUserId mappings to number of services created used as a nonce in createService signature
     */
    mapping(uint256 => uint256) public serviceNonce;

    /**
     * @notice TLUserId mappings to number of proposals created
     */
    mapping(uint256 => uint256) public proposalNonce;

    /**
     * @notice Allowed payment tokens addresses
     */
    mapping(address => AllowedToken) public allowedTokenList;

    /**
     * @notice Minimum percentage of the proposal amount to be released for considering the service as completed
     */
    uint256 public minCompletionPercentage;

    /**
     * @notice Role granting Escrow permission
     */
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // =========================== Modifiers ==============================

    /**
     * @notice Check if the given address is either the owner of the delegate of the given user
     * @param _profileId The TalentLayer ID of the user
     */
    modifier onlyOwnerOrDelegate(uint256 _profileId) {
        require(tlId.isOwnerOrDelegate(_profileId, _msgSender()), "Not owner or delegate");
        _;
    }

    // =========================== Initializers ==============================

    /**
     * @notice First initializer function
     * @param _talentLayerIdAddress TalentLayerId contract address
     * @param _talentLayerPlatformIdAddress TalentLayerPlatformId contract address
     */
    function initialize(address _talentLayerIdAddress, address _talentLayerPlatformIdAddress) public initializer {
        __Ownable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        tlId = ITalentLayerID(_talentLayerIdAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIdAddress);
        nextServiceId = 1;
        updateMinCompletionPercentage(30);
    }

    // =========================== View functions ==============================

    /**
     * @notice Returns the whole service data information
     * @param _serviceId Service identifier
     */
    function getService(uint256 _serviceId) external view returns (Service memory) {
        require(_serviceId < nextServiceId, "This service doesn't exist");
        return services[_serviceId];
    }

    /**
     * @notice Returns the specific proposal for the attached service
     * @param _serviceId Service identifier
     * @param _proposalId Proposal identifier
     */
    function getProposal(uint256 _serviceId, uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_serviceId][_proposalId];
    }

    /**
     * @notice Returns the specific service and the proposal linked to it
     * @param _serviceId Service identifier
     * @param _proposalId Proposal identifier
     */
    function getServiceAndProposal(
        uint256 _serviceId,
        uint256 _proposalId
    ) external view returns (Service memory, Proposal memory) {
        Service memory service = services[_serviceId];
        Proposal memory proposal = proposals[_serviceId][_proposalId];
        return (service, proposal);
    }

    /**
     * @notice Indicates whether the token in parameter is allowed for payment
     * @param _tokenAddress Token address
     */
    function isTokenAllowed(address _tokenAddress) external view returns (bool) {
        return allowedTokenList[_tokenAddress].isWhitelisted;
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows a buyer to initiate an open service
     * @param _profileId The TalentLayer ID of the user owner of the service
     * @param _platformId platform ID on which the Service token was created
     * @param _dataUri IPFS URI of the offchain data of the service
     * @param _signature optional platform signature to allow the operation
     */
    function createService(
        uint256 _profileId,
        uint256 _platformId,
        string calldata _dataUri,
        bytes calldata _signature
    ) public payable onlyOwnerOrDelegate(_profileId) returns (uint256) {
        _validateService(_profileId, _platformId, _dataUri, _signature);

        uint256 id = nextServiceId;
        nextServiceId++;

        Service storage service = services[id];
        service.status = Status.Opened;
        service.ownerId = _profileId;
        service.dataUri = _dataUri;
        service.platformId = _platformId;

        if (serviceNonce[_profileId] == 0 && proposalNonce[_profileId] == 0) {
            tlId.setHasActivity(_profileId);
        }
        serviceNonce[_profileId]++;

        emit ServiceCreated(id, _profileId, _platformId, _dataUri);

        return id;
    }

    /**
     * @notice Allows an seller to propose his service for a service
     * @param _profileId The TalentLayer ID of the user owner of the proposal
     * @param _serviceId The service linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token chosen
     * @param _dataUri token Id to IPFS URI mapping
     * @param _platformId platform ID from where the proposal is created
     * @param _expirationDate the time before the proposal is automatically validated
     * @param _signature optional platform signature to allow the operation
     */
    function createProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        uint256 _platformId,
        string calldata _dataUri,
        uint256 _expirationDate,
        bytes calldata _signature
    ) public payable onlyOwnerOrDelegate(_profileId) {
        _validateProposal(_profileId, _serviceId, _rateToken, _rateAmount, _platformId, _dataUri, _signature);

        proposals[_serviceId][_profileId] = Proposal({
            status: ProposalStatus.Pending,
            ownerId: _profileId,
            rateToken: _rateToken,
            rateAmount: _rateAmount,
            platformId: _platformId,
            dataUri: _dataUri,
            expirationDate: _expirationDate
        });

        if (serviceNonce[_profileId] == 0 && proposalNonce[_profileId] == 0) {
            tlId.setHasActivity(_profileId);
        }
        proposalNonce[_profileId]++;

        emit ProposalCreated(
            _serviceId,
            _profileId,
            _dataUri,
            ProposalStatus.Pending,
            _rateToken,
            _rateAmount,
            _platformId,
            _expirationDate
        );
    }

    /**
     * @notice Allows the owner to update his own proposal for a given service
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId The service linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token chosen
     * @param _dataUri token Id to IPFS URI mapping
     * @param _expirationDate the time before the proposal is automatically validated
     */
    function updateProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        string calldata _dataUri,
        uint256 _expirationDate
    ) public onlyOwnerOrDelegate(_profileId) {
        require(allowedTokenList[_rateToken].isWhitelisted, "Token not allowed");

        Service storage service = services[_serviceId];
        Proposal storage proposal = proposals[_serviceId][_profileId];
        require(service.status == Status.Opened, "Service not opened");
        require(proposal.ownerId == _profileId, "Not the owner");
        require(bytes(_dataUri).length == 46, "Invalid cid");
        require(proposal.status != ProposalStatus.Validated, "Already validated");
        require(_rateAmount >= allowedTokenList[_rateToken].minimumTransactionAmount, "Amount too low");

        proposal.rateToken = _rateToken;
        proposal.rateAmount = _rateAmount;
        proposal.dataUri = _dataUri;
        proposal.expirationDate = _expirationDate;

        emit ProposalUpdated(_serviceId, _profileId, _dataUri, _rateToken, _rateAmount, _expirationDate);
    }

    /**
     * @notice Allow the escrow contract to upgrade the Service state after a deposit has been done
     * @param _serviceId Service identifier
     * @param _proposalId The chosen proposal id for this service
     * @param _transactionId The escrow transaction Id
     */
    function afterDeposit(
        uint256 _serviceId,
        uint256 _proposalId,
        uint256 _transactionId
    ) external onlyRole(ESCROW_ROLE) {
        Service storage service = services[_serviceId];
        Proposal storage proposal = proposals[_serviceId][_proposalId];

        service.status = Status.Confirmed;
        service.acceptedProposalId = proposal.ownerId;
        service.transactionId = _transactionId;
        proposal.status = ProposalStatus.Validated;
    }

    /**
     * @notice Allows the contract owner to add or remove a token from the allowed payment tokens list
     * @param _tokenAddress The address of the payment token
     * @param _isWhitelisted Whether the token is allowed or not
     * @param _minimumTransactionAmount the minimum amount of token allowed for a transaction
     * @dev Only the contract owner can call this function. The owner can't never remove the Ox address
     */
    function updateAllowedTokenList(
        address _tokenAddress,
        bool _isWhitelisted,
        uint256 _minimumTransactionAmount
    ) public onlyOwner {
        if (_tokenAddress == address(0) && !_isWhitelisted) {
            revert("Owner can't remove Ox address");
        }
        allowedTokenList[_tokenAddress].isWhitelisted = _isWhitelisted;
        allowedTokenList[_tokenAddress].minimumTransactionAmount = _minimumTransactionAmount;

        emit AllowedTokenListUpdated(_tokenAddress, _isWhitelisted, _minimumTransactionAmount);
    }

    /**
     * @notice Allow the escrow contract to upgrade the Service state after the full payment has been received by the seller
     * @param _serviceId Service identifier
     * @param _releasedAmount The total amount of the payment released to the seller
     */
    function afterFullPayment(uint256 _serviceId, uint256 _releasedAmount) external onlyRole(ESCROW_ROLE) {
        Service storage service = services[_serviceId];
        Proposal storage proposal = proposals[_serviceId][service.acceptedProposalId];

        uint256 releasedPercentage = (_releasedAmount * 100) / proposal.rateAmount;
        if (releasedPercentage >= minCompletionPercentage) {
            service.status = Status.Finished;
        } else {
            service.status = Status.Uncompleted;
        }
    }

    /**
     * @notice Update Service URI data
     * @param _profileId The TalentLayer ID of the user, owner of the service
     * @param _serviceId, Service ID to update
     * @param _dataUri New IPFS URI
     */
    function updateServiceData(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _dataUri
    ) public onlyOwnerOrDelegate(_profileId) {
        Service storage service = services[_serviceId];
        require(service.ownerId == _profileId, "Not the owner");
        require(service.status == Status.Opened, "status must be opened");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        service.dataUri = _dataUri;

        emit ServiceDetailedUpdated(_serviceId, _dataUri);
    }

    /**
     * @notice Cancel an open Service
     * @param _profileId The TalentLayer ID of the user, owner of the service
     * @param _serviceId Service ID to cancel
     */
    function cancelService(uint256 _profileId, uint256 _serviceId) public onlyOwnerOrDelegate(_profileId) {
        Service storage service = services[_serviceId];

        require(service.ownerId == _profileId, "not the owner");
        require(service.status == Status.Opened, "status must be opened");
        service.status = Status.Cancelled;

        emit ServiceCancelled(_serviceId);
    }

    // =========================== Owner functions ==============================

    /**
     * @notice Allows the contract owner to update the minimum completion percentage for services
     * @param _minCompletionPercentage The new completion percentage
     * @dev Only the contract owner can call this function
     */
    function updateMinCompletionPercentage(uint256 _minCompletionPercentage) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minCompletionPercentage = _minCompletionPercentage;

        emit MinCompletionPercentageUpdated(_minCompletionPercentage);
    }

    // =========================== Overrides ==============================

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (address)
    {
        return ERC2771RecipientUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771RecipientUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771RecipientUpgradeable._msgData();
    }

    // =========================== Private functions ==============================

    /**
     * @notice Validate a new service
     * @param _profileId The TalentLayer ID of the user
     * @param _platformId platform ID on which the Service was created
     * @param _dataUri token Id to IPFS URI mapping
     * @param _signature platform signature to allow the operation
     */
    function _validateService(
        uint256 _profileId,
        uint256 _platformId,
        string calldata _dataUri,
        bytes calldata _signature
    ) private view {
        uint256 servicePostingFee = talentLayerPlatformIdContract.getServicePostingFee(_platformId);
        require(msg.value == servicePostingFee, "Non-matching funds");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        address platformSigner = talentLayerPlatformIdContract.getSigner(_platformId);
        if (platformSigner != address(0)) {
            bytes32 messageHash = keccak256(
                abi.encodePacked("createService", _profileId, ";", serviceNonce[_profileId], _dataUri)
            );
            _validatePlatformSignature(_signature, messageHash, platformSigner);
        }
    }

    /**
     * @notice Validate a new proposal
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId The service linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token chosen
     * @param _platformId platform ID on which the Proposal was created
     * @param _dataUri token Id to IPFS URI mapping
     * @param _signature platform signature to allow the operation
     */
    function _validateProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        uint256 _platformId,
        string calldata _dataUri,
        bytes calldata _signature
    ) private view {
        require(allowedTokenList[_rateToken].isWhitelisted, "Token not allowed");
        uint256 proposalPostingFee = talentLayerPlatformIdContract.getProposalPostingFee(_platformId);
        require(msg.value == proposalPostingFee, "Non-matching funds");
        require(_rateAmount >= allowedTokenList[_rateToken].minimumTransactionAmount, "Amount too low");

        Service storage service = services[_serviceId];
        require(service.status == Status.Opened, "Service not opened");
        require(service.ownerId != 0, "Service not exist");
        require(proposals[_serviceId][_profileId].ownerId != _profileId, "proposal already exist");

        require(service.ownerId != _profileId, "can't create for your own service");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        address platformSigner = talentLayerPlatformIdContract.getSigner(_platformId);
        if (platformSigner != address(0)) {
            bytes32 messageHash = keccak256(abi.encodePacked("createProposal", _profileId, ";", _serviceId, _dataUri));
            _validatePlatformSignature(_signature, messageHash, platformSigner);
        }
    }

    /**
     * @notice Validate the platform ECDSA signature for a given message hash operation
     * @param _signature platform signature to allow the operation
     * @param _messageHash The hash of a generated message corresponding to the operation
     * @param _platformSigner The address defined by the platform as signer
     */
    function _validatePlatformSignature(
        bytes calldata _signature,
        bytes32 _messageHash,
        address _platformSigner
    ) private pure {
        bytes32 ethMessageHash = ECDSAUpgradeable.toEthSignedMessageHash(_messageHash);
        address signer = ECDSAUpgradeable.recover(ethMessageHash, _signature);
        require(_platformSigner == signer, "invalid signature");
    }

    // =========================== Internal functions ==============================

    /**
     * @notice Function that revert when `_msgSender()` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
