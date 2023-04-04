# Deploy Workflow

## To be prepared before deploy

- Setup local .env file to be able to execute all commands.
  - Be sure you have all variables in the .env.example file
  - Mandatory:
    - MNEMONIC
    - SNOWTRACE_API_KEY & POLYGONSCAN_API_KEY: used to validate the contracts
    - INFURA_API_KEY: used by hardhat to deploy
  - Optional
    - SUBGRAPH_FOLDER: useful to easly copy config into subgraph repo
    - DEPLOY_NETWORK: use by Makefile to define network for all commands
    - INFURA_ID & INFURA_SECRET: use by playground script to post json on IPFS
- Be sure that your address has enough fund
- Note: if you have any issue in the command bellow, check the troubleshooting.md
- Replace the network used in the command bellow by the one you want to deploy to. For this documentation we use polygon.

## Step 1: Contract deployment

- Deploy TL contracts: `npx hardhat deploy-full --network polygon --verify`

## Step 2: Setup initial data

- Double-check the [networkConfig.ts](../networkConfig.ts), it contains all setups for the current network
  - multisigAddressList: list of multisig addresses used to receive fee and with ownership of upgradabiltiy
  - allowedTokenList: list of tokens allowed to be used as payment
  - platformList: list of platform name and address used to create our partners platformId
- Launch the setup command, it will automatically add the multisig addresses, the allowed tokens and the platformIds
  - `npx hardhat initial-setup --network polygon`

## Step 3: Update Subgraph

### Update configuration

- Update the abis from the contract folder to the graph folder
- configure your env var `DEPLOY_NETWORK`
- Update network.json file with the new deployed addresses: `make update-graph-config`
- Update the start block in the network.json. Use the block number of the first contract deployed

### Deploy your subgraph

- Update the abis in the subgraph repo
- Generate code from your GraphQL schema and operations.: `graph codegen`
- Copy configuration from network.json and buid graph code: `graph build --network polygon`
- Authenticate to the hosted service: `graph auth --network polygon --product hosted-service <your access token>`
- Deploy to the hosted service:
  - polygon: `graph deploy --product hosted-service talentlayer/talent-layer-polygon`
  - fuji: `graph deploy --product hosted-service talentlayer/talent-layer-fuji`

## Step 4: Update Indie Frontend

- Update the abis in the frontend repo `make update-frontend-config`
- Fill the network const with the right deployed addresses in the **src > config.ts** file

## Step 5: Defender

- Transfer ownership to the multisig for every contracts
  - for ownable contracts: 
    - `npx hardhat transfer-ownership --contract-name "TalentLayerID" --address 0x0CFF3F17b62704A0fc76539dED9223a44CAf4825 --network polygon`
    - `npx hardhat transfer-ownership --contract-name "TalentLayerService" --address 0x0CFF3F17b62704A0fc76539dED9223a44CAf4825 --network polygon`
    - `npx hardhat transfer-ownership --contract-name "TalentLayerReview" --address 0x0CFF3F17b62704A0fc76539dED9223a44CAf4825 --network polygon`
    - `npx hardhat transfer-ownership --contract-name "TalentLayerEscrow" --address 0x0CFF3F17b62704A0fc76539dED9223a44CAf4825 --network polygon`
  - for access control contracts: 
    - `npx hardhat grant-role --contract-name "TalentLayerPlatformID" --address 0x0CFF3F17b62704A0fc76539dED9223a44CAf4825 --network polygon`


