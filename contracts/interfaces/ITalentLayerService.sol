// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title Platform ID Interface
 * @author TalentLayer Team <labs@talentlayer.org> | Website: https://talentlayer.org | Twitter: @talentlayer
 */
interface ITalentLayerService {
    // Enum declarations
    enum Status {
        Opened,
        Confirmed,
        Finished,
        Cancelled,
        Uncompleted
    }

    enum ProposalStatus {
        Pending,
        Validated
    }

    // Struct declarations
    struct Service {
        Status status;
        uint256 ownerId;
        uint256 acceptedProposalId;
        string dataUri;
        uint256 transactionId;
        uint256 platformId;
    }

    struct Proposal {
        ProposalStatus status;
        uint256 ownerId;
        address rateToken;
        uint256 rateAmount;
        uint256 platformId;
        string dataUri;
        uint256 expirationDate;
    }

    struct AllowedToken {
        bool isWhitelisted;
        uint256 minimumTransactionAmount;
    }

    // Function declarations
    // View Functions
    function getService(uint256 _serviceId) external view returns (Service memory);

    function getProposal(uint256 _serviceId, uint256 _proposalId) external view returns (Proposal memory);

    function getServiceAndProposal(
        uint256 _serviceId,
        uint256 _proposalId
    ) external view returns (Service memory, Proposal memory);

    function isTokenAllowed(address _tokenAddress) external view returns (bool);

    // User Functions
    function createService(
        uint256 _profileId,
        uint256 _platformId,
        string calldata _dataUri,
        bytes calldata _signature
    ) external payable returns (uint256);

    function createProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        uint256 _platformId,
        string calldata _dataUri,
        uint256 _expirationDate,
        bytes calldata _signature
    ) external payable;

    function updateProposal(
        uint256 _profileId,
        uint256 _serviceId,
        address _rateToken,
        uint256 _rateAmount,
        string calldata _dataUri,
        uint256 _expirationDate
    ) external;

    function afterDeposit(uint256 _serviceId, uint256 _proposalId, uint256 _transactionId) external;

    function afterFullPayment(uint256 _serviceId, uint256 _releasedAmount) external;

    function updateServiceData(uint256 _profileId, uint256 _serviceId, string calldata _dataUri) external;

    function cancelService(uint256 _profileId, uint256 _serviceId) external;

    // Owner Functions
    function updateAllowedTokenList(
        address _tokenAddress,
        bool _isWhitelisted,
        uint256 _minimumTransactionAmount
    ) external;

    function updateMinCompletionPercentage(uint256 _minCompletionPercentage) external;

    // Event declarations
    event ServiceCreated(uint256 id, uint256 ownerId, uint256 platformId, string dataUri);
    event ServiceCancelled(uint256 id);
    event ServiceDetailedUpdated(uint256 indexed id, string dataUri);
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
    event ProposalUpdated(
        uint256 serviceId,
        uint256 ownerId,
        string dataUri,
        address rateToken,
        uint256 rateAmount,
        uint256 expirationDate
    );
    event AllowedTokenListUpdated(address tokenAddress, bool isWhitelisted, uint256 minimumTransactionAmount);
    event MinCompletionPercentageUpdated(uint256 minCompletionPercentage);
}
