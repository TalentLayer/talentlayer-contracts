# Upgrade Workflow

## To be prepared before upgrade

- Be sure all the tests are passing: `npx hardhat test --typecheck`

## Case 1: Upgrade with Defender and a multisig

_Useful for official testnet and mainnet_

- First, make sure that:
  - the deployer multi-sig address is added to the `multisigAddressList` in the [networkConfig.ts](../networkConfig.ts) file
  - and the multi-sig got the ownership of the proxy contract: `npx hardhat transfer-proxy-ownership --contract-name "TalentLayerService" --address 0x99f117069F9ED15476003502AD8D96107A180648 --network mumbai`
- Then launch the proposal command: `npx hardhat prepare-upgrade --contract-name "TalentLayerServiceV2" --proxy-name "TalentLayerService" --network mumbai`
- How it works:
  - It uses hardhat task `prepare-upgrade` in [prepare-upgrade.ts](../scripts/tasks/deploy/prepare-upgrade.ts) :
  - `--contract-name "TalentLayerServiceV2"`: Define the new contract name
  - `--proxy-name "TalentLayerService"`: Define the proxy name, it's the original name of the contract
  - It will automatically:
    - get for corresponding addresses
    - verify that the upgrade don't include incompatible code
    - deploy the new contract implementation
    - verify the new contract
    - send a proposal to our defender account ready to be executed by the multisig
    - From defender, we now can validate the upgrade

## Case 2: Upgrade directly

_Useful for your own local or testnet environment_

- Launch: `npx hardhat upgrade-proxy --contract-name "TalentLayerServiceV2" --proxy-name "TalentLayerService" --verify --network mumbai`
- How it works:
  - It uses hardhat task `upgrade-proxy` in [upgrade-proxy.ts](../scripts/tasks/deploy/upgrade-proxy.ts) :
  - `--contract-name "TalentLayerServiceV2"`: Define the new contract name
  - `--proxy-name "TalentLayerService"`: Define the proxy name, it's the original name of the contract
  - It will automatically:
    - get for corresponding addresses
    - verify that the upgrade don't include incompatible code
    - Deploy the upgrade and activate it with the proxy
    - Verify the new contract
