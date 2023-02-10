# Deploy Workflow

## To be prepared before deploy

- Setup your local .env file to be able to execute all commands.
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
- Replace the network used in the command bellow by the one you want to deploy to. For this documentation we use mumbai.

## Step 1: Contract deployment

- Deploy TL contracts: `npx hardhat deploy-full --network mumbai --verify`

## Step 2: Setup initial data

- Double check the [networkConfig.ts](./networkConfig.ts), it contains all setups for the current network
  - multisigAddressList: list of multisig addresses used to receive fee and with ownership of upgradabiltiy
  - allowedTokenList: list of tokens allowed to be used as payment
  - platformList: list of platform name and address used to create our partners platformId
- Launch the setup command, it will automatically add the multisig addresses, the allowed tokens and the platformIds
  - `npx hardhat initial-setup --network mumbai`

## Step 3: Update Subgraph

### Update configuration

- Update the abis from the contract folder to the graph folder
- Update network.json file with the new deployed addresses: `npx hardhat run scripts/utils/setSubgraphNetwork.ts --network mumbai`
- Update the start block in the network.json. Use the block number of the first contract deployed

### Deploy your subgraph

- Update the abis in the subgraph repo
- Generate code from your GraphQL schema and operations.: `graph codegen`
- Copy configuration from network.json and buid graph code: `graph build --network mumbai`
- Authenticad to the hosted service: `graph auth --network mumbai --product hosted-service <your access token>`
- Deploy to the hosted service:
  - mumbai: `graph deploy --product hosted-service talentlayer/talent-layer-mumbai`
  - fuji: `graph deploy --product hosted-service talentlayer/talent-layer-fuji`

## Step 4: Update Indie Frontend

- Update the abis in the frontend repo
- Fill the network const with the right deployed addresses in the **src > config.ts** file
