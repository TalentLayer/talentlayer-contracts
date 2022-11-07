// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IServiceRegistry.sol";
import "../interfaces/ITalentLayerID.sol";
import "../interfaces/ITalentLayerPlatformID.sol";
import "./IArbitrable.sol";
import "./Arbitrator.sol";

contract TalentLayerMultipleArbitrableTransaction is Ownable {

    // =========================== Enum ==============================

    /// @notice Enum payment type
    enum PaymentType {
        Release,
        Reimburse
    }

    // =========================== Struct ==============================

    struct Transaction {
        address sender; //pays recipient using the escrow
        address receiver; //intended recipient of the escrow
        address token; //token of the escrow
        uint256 amount; //amount locked into escrow
        uint256 serviceId; //the serviceId related to the transaction
        uint8 protocolFee;
        uint8 originPlatformFee;
        uint8 platformFee;
    }

    // =========================== Events ==============================

    /// @notice Emitted after a service is finished
    /// @param serviceId The associated service ID
    /// @param sellerId The talentLayerId of the associated seller
    /// @param transactionId The associated escrow transaction ID
    event ServiceProposalConfirmedWithDeposit(
        uint256 serviceId,
        uint256 sellerId,
        uint256 transactionId
    );

    /// @notice Emitted after each payment
    ///  @param _paymentType Whether the payment is a release or a reimbursement.
    ///  @param _amount The amount paid.
    ///  @param _token The address of the token used for the payment.
    ///  @param _serviceId The id of the concerned service.
    event Payment(
        PaymentType _paymentType,
        uint256 _amount,
        address _token,
        uint256 _serviceId
    );

    /// @notice Emitted after a service is finished
    /// @param _serviceId The service ID
    event PaymentCompleted(uint256 _serviceId);

    //TODO Are these events useful ?
    event ProtocolFeeUpdated(uint256 _protocolFee);

    event OriginPlatformFeeUpdated(uint256 _originPlatformFee);

    // =========================== Declarations ==============================

    Transaction[] private transactions; //transactions stored in array with index = id
    //Id 0 is reserved to the protocol balance
    mapping(uint256 => mapping(address => uint256)) private platformIdToTokenToBalance;
    IServiceRegistry private serviceRegistryContract; //instance of ServiceRegistry.sol
    ITalentLayerID private talentLayerIdContract; //instance of TalentLayerID.sol
    ITalentLayerPlatformID private talentLayerPlatformIdContract; //instance of TalentLayerPlatformID.sol
    uint8 public protocolFeePerTenThousand; //Percentage paid to the protocol (per 10,000, upgradable)
    uint8 public originPlatformFeePerTenThousand; //Percentage paid to the platform who onboarded the user (per 10,000, upgradable)
    //    uint256 public platformFeePerTenThousand; //TODO: Remplacer par un appel externe à TPID (struct qui a la valeur de la fee)
    address private protocolWallet;

    // =========================== Constructor ==============================

    /** @dev Called on contract deployment
     *  @param _serviceRegistryAddress Contract address to ServiceRegistry.sol
     *  @param _talentLayerIDAddress Contract address to TalentLayerID.sol
     *  @param _talentLayerPlatformIDAddress Contract address to TalentLayerPlatformID.sol
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _feeTimeout Arbitration fee timeout for the parties.
     */
    constructor(
        address _serviceRegistryAddress,
        address _talentLayerIDAddress,
        address _talentLayerPlatformIDAddress,
        Arbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        uint _feeTimeout
    ) {
        serviceRegistryContract = IServiceRegistry(_serviceRegistryAddress);
        talentLayerIdContract = ITalentLayerID(_talentLayerIDAddress);
        talentLayerPlatformIdContract = ITalentLayerPlatformID(_talentLayerPlatformIDAddress);
        protocolFeePerTenThousand = 100;
        originPlatformFeePerTenThousand = 200;
        //        TODO: Set a default platform fee ?
        //        platformFeePerTenThousand = 700;
        //TODO For now msg.sender
        protocolWallet = msg.sender;
        // arbitrator = _arbitrator;
        // arbitratorExtraData = _arbitratorExtraData;
        // feeTimeout = _feeTimeout;
    }

    // =========================== View functions ==============================

    /** @dev Only the owner of the platform ID can execute this function
     *  @param _token Token address ("0" for ETH)
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        uint256 platformId = talentLayerPlatformIdContract.getPlatformIdFromAddress(msg.sender);
        talentLayerPlatformIdContract.isValid(platformId);
        return platformIdToTokenToBalance[platformId][_token];
    }


    // =========================== Owner functions ==============================

    function updateProtocolFee(uint8 _protocolFee) external onlyOwner {
        protocolFeePerTenThousand = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    function updateOriginPlatformFee(uint8 _originPlatformFee) external onlyOwner {
        originPlatformFeePerTenThousand = _originPlatformFee;
        emit OriginPlatformFeeUpdated(_originPlatformFee);
    }

    function updateProtocolWallet(address _protocolWallet) external onlyOwner {
        protocolWallet = _protocolWallet;
    }

    // =========================== User functions ==============================

    /**  @dev Validates a proposal for a service by locking ETH into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _serviceId Service of transaction
     *  @param _serviceId Id of the service that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates.
     */
    //TODO: Ajouter les fees dans la transaction
    function createETHTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external payable {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        uint8 platformFeePerTenThousand = talentLayerPlatformIdContract.getPlatformFeeFromId(service.platformId);


        uint256 transactionAmount = proposal.rateAmount + (
        (
        (proposal.rateAmount * protocolFeePerTenThousand) +
        (proposal.rateAmount * originPlatformFeePerTenThousand) +
        (proposal.rateAmount * platformFeePerTenThousand)
        ) / 10000
        );

        require(msg.sender == sender, "Access denied.");
        require(msg.value == transactionAmount, "Non-matching funds.");
        require(proposal.rateToken == address(0), "Proposal token not ETH.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");

        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, transactionAmount, _serviceId, platformFeePerTenThousand);
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);

        //TODO: add amount in escrow in event ?
        emit ServiceProposalConfirmedWithDeposit(
            _serviceId,
            proposal.sellerId,
            transactionId
        );
    }

    /** @dev Validates a proposal for a service by locking ERC20 into escrow.
     *  @param _timeoutPayment Time after which a party can automatically execute the arbitrable transaction.
     *  @param _metaEvidence Link to the meta-evidence.
     *  @param _serviceId Id of the service that the sender created and the proposal was made for.
     *  @param _proposalId Id of the proposal that the transaction validates.
     */
    function createTokenTransaction(
        uint256 _timeoutPayment,
        string memory _metaEvidence,
        uint256 _serviceId,
        uint256 _proposalId
    ) external {
        IServiceRegistry.Proposal memory proposal;
        IServiceRegistry.Service memory service;
        address sender;
        address receiver;

        (proposal, service, sender, receiver) = _getTalentLayerData(_serviceId, _proposalId);
        uint8 platformFeePerTenThousand = talentLayerPlatformIdContract.getPlatformFeeFromId(service.platformId);

        uint256 transactionAmount = proposal.rateAmount + (
        (
        (proposal.rateAmount * protocolFeePerTenThousand) +
        (proposal.rateAmount * originPlatformFeePerTenThousand) +
        (proposal.rateAmount * platformFeePerTenThousand)
        ) / 10000
        );

        require(service.status == IServiceRegistry.Status.Opened, "Service status not open.");
        require(proposal.status == IServiceRegistry.ProposalStatus.Pending, "Proposal status not pending.");
        require(proposal.sellerId == _proposalId, "Incorrect proposal ID.");

        uint256 transactionId = _saveTransaction(sender, receiver, proposal.rateToken, transactionAmount, _serviceId, platformFeePerTenThousand);
        serviceRegistryContract.afterDeposit(_serviceId, _proposalId, transactionId);
        _deposit(sender, proposal.rateToken, transactionAmount);

        emit ServiceProposalConfirmedWithDeposit(
            _serviceId,
            proposal.sellerId,
            transactionId
        );
    }

    /**  @dev Allows the sender to release locked-in escrow value to the intended recipient.
        The amount released must not include the fees.
     *  @param _transactionId Id of the transaction to release escrow value for.
     *  @param _amount Value to be released. Should not be more than amount locked in.
     */
    function release(
        uint256 _transactionId,
        uint256 _amount
    ) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.sender == msg.sender, "Access denied.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _release(transaction, _amount);

        emit Payment(PaymentType.Release, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    /** @dev Allows the intended receiver to return locked-in escrow value back to the sender.
     *  @param _transactionId Id of the transaction to reimburse escrow value for.
     *  @param _amount Value to be reimbursed. Should not be more than amount locked in.
     */
    function reimburse(
        uint256 _transactionId,
        uint256 _amount
    ) external {
        require(transactions.length > _transactionId, "Not a valid transaction id.");
        Transaction storage transaction = transactions[_transactionId];

        require(transaction.receiver == msg.sender, "Access denied.");
        require(transaction.amount >= _amount, "Insufficient funds.");

        transaction.amount -= _amount;
        _reimburse(transaction, _amount);

        emit Payment(PaymentType.Reimburse, _amount, transaction.token, transaction.serviceId);

        _distributeMessage(transaction.serviceId, transaction.amount);
    }

    /** @notice Allows the platform to claim its tokens & / or ETH balance.
     *  @param _platformId The ID of the platform claiming the balance.
     *  @param _tokenAddress The address of the Token contract (address(0) if balance in ETH).
     */
    function claim(uint256 _platformId, address _tokenAddress) external {
        talentLayerPlatformIdContract.isValid(_platformId);
        require(talentLayerPlatformIdContract.ownerOf(_platformId) == msg.sender, "Access denied.");

        uint256 amount = platformIdToTokenToBalance[_platformId][_tokenAddress];
        platformIdToTokenToBalance[_platformId][_tokenAddress] = 0;

        if(_tokenAddress == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(_tokenAddress).transferFrom(address(this), msg.sender, amount);
        }
    }

    /** @notice Allows the platform to claim all its tokens & / or ETH balances.
     *  @param _platformId The ID of the platform claiming the balance.
     */
    function claimAll(uint256 _platformId) external {
        //TODO Copy Lugus
    }


    // =========================== Private functions ==============================


    function _saveTransaction(
        address _sender,
        address _receiver,
        address _token,
        uint256 _amount,
        uint256 _serviceId,
        uint8 _platformFeePerTenThousand
    ) private returns (uint256){
        transactions.push(
            Transaction({
        sender: _sender,
        receiver: _receiver,
        token: _token,
        amount: _amount,
        serviceId: _serviceId,
        protocolFee: protocolFeePerTenThousand,
        originPlatformFee: originPlatformFeePerTenThousand,
        platformFee: _platformFeePerTenThousand
        })
        );
        return transactions.length -1;
    }

    function _deposit(
        address _sender,
        address _token,
        uint256 _amount
    ) private {
        require(
            IERC20(_token).transferFrom(_sender, address(this), _amount),
            "Transfer must not fail"
        );
    }

    function _release(
        Transaction memory _transaction,
        uint256 _releaseAmount
    ) private {
        IServiceRegistry.Service memory service = serviceRegistryContract.getService(_transaction.serviceId);

        //Platform which onboarded the user
        uint256 originPlatformId = talentLayerIdContract.getProfile(talentLayerIdContract.walletOfOwner(_transaction.receiver)).platformId;
        //Platform which originated the service
        uint256 platformId = service.platformId;

        if(_transaction.token == address(0)){
            payable(_transaction.receiver).transfer(_releaseAmount);

            //Index zero represents protocol's balance
            platformIdToTokenToBalance[0][address(0)] += (_transaction.protocolFee * _releaseAmount) / 10000;
            platformIdToTokenToBalance[originPlatformId][address(0)] += (_transaction.originPlatformFee * _releaseAmount) / 10000;
            platformIdToTokenToBalance[platformId][address(0)] += (_transaction.platformFee * _releaseAmount) / 10000;
        } else {
            require(
                IERC20(_transaction.token).transfer(_transaction.receiver, _releaseAmount),
                "Transfer must not fail"
            );

            platformIdToTokenToBalance[0][_transaction.token] += (_transaction.protocolFee * _releaseAmount) / 10000;
            platformIdToTokenToBalance[originPlatformId][_transaction.token] += (_transaction.originPlatformFee * _releaseAmount) / 10000;
            platformIdToTokenToBalance[platformId][_transaction.token] += (_transaction.platformFee * _releaseAmount) / 10000;
        }
    }

    /**
    * @dev If token payment, need token approval for the transfer of _releaseAmount before executing this function
      @param _transaction The transaction
      @param _releaseAmount The amount to reimburse without fees
    */
    function _reimburse(Transaction memory _transaction, uint256 _releaseAmount) private {
        uint256 totalReleaseAmount = _releaseAmount + (((_transaction.protocolFee + _transaction.originPlatformFee + _transaction.platformFee) * _releaseAmount) / 10000);

        if(_transaction.token == address(0)){
            payable(_transaction.sender).transfer(totalReleaseAmount);
        } else {
            require(
                IERC20(_transaction.token).transfer(_transaction.sender, totalReleaseAmount),
                "Transfer must not fail"
            );
        }
    }

    function _distributeMessage(
        uint256 _serviceId,
        uint256 _amount
    ) private {
        if (_amount == 0) {
            serviceRegistryContract.afterFullPayment(_serviceId);
            emit PaymentCompleted(_serviceId);
        }
    }

    function _getTalentLayerData(
        uint256 _serviceId,
        uint256 _proposalId
    ) private returns (
        IServiceRegistry.Proposal memory proposal,
        IServiceRegistry.Service memory service,
        address sender,
        address receiver
    ) {
        IServiceRegistry.Proposal memory proposal = _getProposal(_serviceId, _proposalId);
        IServiceRegistry.Service memory service = _getService(_serviceId);
        address sender = talentLayerIdContract.ownerOf(service.buyerId);
        address receiver = talentLayerIdContract.ownerOf(proposal.sellerId);
        return (proposal, service, sender, receiver);
    }

    function _getProposal(
        uint256 _serviceId, uint256 _proposalId
    ) private view returns (IServiceRegistry.Proposal memory){
        return serviceRegistryContract.getProposal(_serviceId, _proposalId);
    }

    function _getService(
        uint256 _serviceId
    ) private view returns (IServiceRegistry.Service memory){
        return serviceRegistryContract.getService(_serviceId);
    }
}