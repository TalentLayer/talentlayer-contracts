
## Workflow

> Step 1 : Contract deployment
- Check if all the .env variable is complete
- select the network by changing the variable DEPLOY_NETWORK =...
- Check the make file command add the command you want to the ``npx hardhat deploy``
  - add : ``--use-pohmock`` will use the POH Mock
  - add : `` --use-test-erc20`` will deploy a ERC20 token
  - add : `` --verify `` will verify the contract on the network scan
