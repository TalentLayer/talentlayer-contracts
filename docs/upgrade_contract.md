# Upgrade Workflow 

## To be prepared before upgrade

- Be sure all the tests are passing: `npx hardhat test --typecheck`

## Case 1: Upgrade with Defender and a multisig

*Useful for official testnet and mainnet*

- First, make sure that: 
    - the deployer multisig address is added to the `multisigAddressList` in the [networkConfig.ts](./../networkConfig.ts) file
    - and the multisig got the ownership of the proxy contract: `npx hardhat transfer-proxy-ownership --contract-name "ServiceRegistry" --address 0x99f117069F9ED15476003502AD8D96107A180648 --network mumbai`
- Then launch the proposal command: `npx hardhat propose-upgrade --contract-name "ServiceRegistryV2" --proxy-name "ServiceRegistry" --network mumbai`
- How it works: 
    - It use hardhat task `propose-upgrade` in [propose-upgrade.ts](./../scripts/tasks/deploy/prepare-upgrade.ts) :
    - `--contract-name "ServiceRegistryV2"`: Define the new contract name
    - `--proxy-name "ServiceRegistry"`: Define the proxy name, it's the original name of the contract
    - It will automatically:
        - get for corresponding addresses
        - verify that the upgrade don't include incompatible code
        - deploy the new contract implementation
        - verify the new contract
        - send a proposal to our defender account ready to be executed by the multisig
        - From defender, we now can validated the upgrade 
    

## Case 2: Upgrade directly

*Useful for your own local or testnet environment*

- Launch: `npx hardhat upgrade-proxy --contract-name "ServiceRegistryV2" --proxy-name "ServiceRegistry" --verify --network mumbai`
- How it works: 
    - It use hardhat task `upgrade-proxy` in [upgrade-proxy.ts](./../scripts/tasks/deploy/upgrade-proxy.ts) :
    - `--contract-name "ServiceRegistryV2"`: Define the new contract name
    - `--proxy-name "ServiceRegistry"`: Define the proxy name, it's the original name of the contract
    - It will automatically:
        - get for corresponding addresses
        - verify that the upgrade don't include incompatible code
        - Deploy the upgrade and activate it with the proxy 
        - Verify the new contract
    