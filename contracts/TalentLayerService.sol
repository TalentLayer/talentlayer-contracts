// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ITalentLayerID} from "./interfaces/ITalentLayerID.sol";
import {ITalentLayerPlatformID} from "./interfaces/ITalentLayerPlatformID.sol";
import {ERC2771RecipientUpgradeable} from "./libs/ERC2771RecipientUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TalentLayerService Contract
 * @author TalentLayer Team
 */
contract TalentLayerService is Initializable, ERC2771RecipientUpgradeable, UUPSUpgradeable, AccessControlUpgradeable {
    // =========================== Enum ==============================

    /// @notice Enum service status
    enum Status {
        Opened,
        Confirmed,
        Finished,
        Cancelled
    }

    /// @notice Enum service status
    enum ProposalStatus {
        Pending,
        Validated
    }

    // =========================== Struct ==============================

    /// @notice Service information struct
    /// @param status the current status of a service
    /// @param ownerId the talentLayerId of the buyer
    /// @param acceptedProposalId the accepted proposal ID
    /// @param dataUri token Id to IPFS URI mapping
    /// @param proposals all proposals for this service
    /// @param transactionId the escrow transaction ID linked to the service
    /// @param platformId the platform ID on which the service was created
    struct Service {
        Status status;
        uint256 ownerId;
        uint256 acceptedProposalId;
        string dataUri;
        uint256 transactionId;
        uint256 platformId;
    }

    /// @notice Proposal information struct
    /// @param status the current status of a service
    /// @param ownerId the talentLayerId of the seller
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token chosen
    /// @param dataUri token Id to IPFS URI mapping
    /// @param expirationDate the timeout for the proposal
    struct Proposal {
        ProposalStatus status;
        uint256 ownerId;
        address rateToken;
        uint256 rateAmount;
        uint16 platformId;
        string dataUri;
        uint256 expirationDate;
    }

    /// @notice Whitelisted token information struct
    /// @param tokenAddress the token address
    /// @param minimumTransactionAmount the minimum transaction value
    struct AllowedToken {
        bool isWhitelisted;
        uint256 minimumTransactionAmount;
    }

    // =========================== Events ==============================

    /// @notice Emitted after a new service is created
    /// @param id The service ID (incremental)
    /// @param ownerId the talentLayerId of the buyer
    /// @param platformId platform ID on which the Service token was minted
    /// @param dataUri token Id to IPFS URI mapping
    /// @dev Events "ServiceCreated"
    event ServiceCreated(uint256 id, uint256 ownerId, uint256 platformId, string dataUri);

    /// @notice Emitted after a service is cancelled by the owner
    /// @param id The service ID
    event ServiceCancelled(uint256 id);

    /**
     * Emit when Cid is updated for a Service
     * @param id The service ID
     * @param dataUri New service Data URI
     */
    event ServiceDetailedUpdated(uint256 indexed id, string dataUri);

    /// @notice Emitted after a new proposal is created
    /// @param serviceId The service id
    /// @param ownerId The talentLayerId of the seller who made the proposal
    /// @param dataUri token Id to IPFS URI mapping
    /// @param status proposal status
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token chosen
    /// @param platformId the platform ID on which the proposal was created
    event ProposalCreated(
        uint256 serviceId,
        uint256 ownerId,
        string dataUri,
        ProposalStatus status,
        address rateToken,
        uint256 rateAmount,
        uint16 platformId,
        uint256 expirationDate
    );

    /// @notice Emitted after an existing proposal has been updated
    /// @param serviceId The service id
    /// @param ownerId The talentLayerId of the seller who made the proposal
    /// @param dataUri token Id to IPFS URI mapping
    /// @param rateToken the token choose for the payment
    /// @param rateAmount the amount of token chosen
    /// @param _expirationDate the timeout for the proposal
    event ProposalUpdated(
        uint256 serviceId,
        uint256 ownerId,
        string dataUri,
        address rateToken,
        uint256 rateAmount,
        uint256 _expirationDate
    );

    /**
     * @notice Emitted when the contract owner adds or removes a token from the allowed payment tokens list
     * @param _tokenAddress The address of the payment token
     * @param _status Whether the token is allowed or not
     * @param _minimumTransactionAmount The minimum transaction fees for the token
     */
    event AllowedTokenListUpdated(address _tokenAddress, bool _status, uint256 _minimumTransactionAmount);

    // =========================== Mappings & Variables ==============================

    /// @notice incremental service Id
    uint256 public nextServiceId;

    /// @notice TalentLayerId address
    ITalentLayerID private tlId;

    /// TalentLayer Platform ID registry
    ITalentLayerPlatformID public talentLayerPlatformIdContract;

    /// @notice services mappings index by ID
    mapping(uint256 => Service) public services;

    /// @notice proposals mappings index by service ID and seller TID
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals;

    /// @notice Allowed payment tokens addresses
    mapping(address => AllowedToken) public allowedTokenList;

    // @notice
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
     * @notice Indicates whether the token in parameter is allowed for payment
     * @param _tokenAddress Token address
     */
    function isTokenAllowed(address _tokenAddress) external view returns (bool) {
        return allowedTokenList[_tokenAddress].isWhitelisted;
    }

    // =========================== User functions ==============================

    /**
     * @notice Allows an buyer to initiate an open service
     * @param _profileId The TalentLayer ID of the user
     * @param _platformId platform ID on which the Service token was minted
     * @param _dataUri token Id to IPFS URI mapping
     */
    function createService(
        uint256 _profileId,
        uint256 _platformId,
        string calldata _dataUri
    ) public payable onlyOwnerOrDelegate(_profileId) returns (uint256) {
        uint256 servicePostingFee = talentLayerPlatformIdContract.getServicePostingFee(_platformId);
        require(msg.value == servicePostingFee, "Non-matching funds");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        uint256 id = nextServiceId;
        nextServiceId++;

        Service storage service = services[id];
        service.status = Status.Opened;
        service.ownerId = _profileId;
        service.dataUri = _dataUri;
        service.platformId = _platformId;

        emit ServiceCreated(id, _profileId, _platformId, _dataUri);

        return id;
    }

    /**
     * @notice Allows an seller to propose his service for a service
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId The service linked to the new proposal
     * @param _rateToken the token choose for the payment
     * @param _rateAmount the amount of token chosen
     * @param _dataUri token Id to IPFS URI mapping
     * @param _platformId platform ID
     * @param _expirationDate the time before the proposal is automatically validated
     */
    function createProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        uint16 _platformId,
        string calldata _dataUri,
        uint256 _expirationDate
    ) public payable onlyOwnerOrDelegate(_profileId) {
        require(allowedTokenList[_rateToken].isWhitelisted, "This token is not allowed");
        uint256 proposalPostingFee = talentLayerPlatformIdContract.getProposalPostingFee(_platformId);
        require(msg.value == proposalPostingFee, "Non-matching funds");
        require(_rateAmount >= allowedTokenList[_rateToken].minimumTransactionAmount, "Amount is too low");

        Service storage service = services[_serviceId];
        require(service.status == Status.Opened, "Service is not opened");
        require(
            proposals[_serviceId][_profileId].ownerId != _profileId,
            "You already created a proposal for this service"
        );

        require(service.ownerId != _profileId, "You couldn't create proposal for your own service");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        proposals[_serviceId][_profileId] = Proposal({
            status: ProposalStatus.Pending,
            ownerId: _profileId,
            rateToken: _rateToken,
            rateAmount: _rateAmount,
            platformId: _platformId,
            dataUri: _dataUri,
            expirationDate: _expirationDate
        });

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
     * @notice Allows an seller to update his own proposal for a given service
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
        require(allowedTokenList[_rateToken].isWhitelisted, "This token is not allowed");

        Service storage service = services[_serviceId];
        Proposal storage proposal = proposals[_serviceId][_profileId];
        require(service.status == Status.Opened, "Service is not opened");
        require(proposal.ownerId == _profileId, "This proposal doesn't exist yet");
        require(bytes(_dataUri).length == 46, "Invalid cid");
        require(proposal.status != ProposalStatus.Validated, "This proposal is already updated");
        require(_rateAmount >= allowedTokenList[_rateToken].minimumTransactionAmount, "Amount is too low");

        proposal.rateToken = _rateToken;
        proposal.rateAmount = _rateAmount;
        proposal.dataUri = _dataUri;

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
     * @param _status Whether the token is allowed or not
     * @dev Only the contract owner can call this function
     */
    function updateAllowedTokenList(
        address _tokenAddress,
        bool _status,
        uint256 _minimumTransactionAmount
    ) public onlyOwner {
        if (_tokenAddress == address(0) && _status == false) {
            revert("Owner can't remove Ox address");
        }
        allowedTokenList[_tokenAddress].isWhitelisted = _status;
        allowedTokenList[_tokenAddress].minimumTransactionAmount = _minimumTransactionAmount;

        emit AllowedTokenListUpdated(_tokenAddress, _status, _minimumTransactionAmount);
    }

    /**
     * @notice Allow the escrow contract to upgrade the Service state after the full payment has been received by the seller
     * @param _serviceId Service identifier
     */
    function afterFullPayment(uint256 _serviceId) external onlyRole(ESCROW_ROLE) {
        Service storage service = services[_serviceId];
        service.status = Status.Finished;
    }

    /**
     * Update Service URI data
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId, Service ID to update
     * @param _dataUri New IPFS URI
     */
    function updateServiceData(
        uint256 _profileId,
        uint256 _serviceId,
        string calldata _dataUri
    ) public onlyOwnerOrDelegate(_profileId) {
        Service storage service = services[_serviceId];
        require(service.ownerId == _profileId, "Only the owner can update the service");
        require(service.status == Status.Opened, "Service status should be opened");
        require(bytes(_dataUri).length == 46, "Invalid cid");

        service.dataUri = _dataUri;

        emit ServiceDetailedUpdated(_serviceId, _dataUri);
    }

    /**
     * Cancel a Service
     * @param _profileId The TalentLayer ID of the user
     * @param _serviceId, Service ID to cancel
     */
    function cancelService(uint256 _profileId, uint256 _serviceId) public onlyOwnerOrDelegate(_profileId) {
        Service storage service = services[_serviceId];

        require(service.ownerId == _profileId, "Only the owner can cancel the service");
        require(service.status == Status.Opened, "Only services with the open status can be cancelled");
        service.status = Status.Cancelled;

        emit ServiceCancelled(_serviceId);
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

    // =========================== Internal functions ==============================

    /**
     * @notice Function that revert when `_msgSender()` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     * @param newImplementation address of the new contract implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
