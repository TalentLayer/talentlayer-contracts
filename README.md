# TalentLayer

An interoperable identity system for freelancing marketplaces. Leverage one unified, self-owned, identity across many freelancing marketplaces. Realize #WorkSovereignty by owning your work reputation.

Learn more about the project: https://www.talentlayer.org

## Documentations

*Our documentations are in Notion and Gitbook. Here are some links to the most important pages:*

Start integrating TalentLayer: 
- The complete official user documentation: https://docs.talentlayer.org

Understand the protocol:
- Upgradability: https://talentlayer.notion.site/Upgradability-c4265e3a8dc64cdb8167083a5a899828

## Deployment addresses: 

- [Goerli](./deployments/goerli.json)
- [Fuji](./deployments/fuji.json)
- [Mumbai](./deployments/mumbai.json)

## Setup locally 

- Create your env file config: `mv .env.example .env`
- Complete all the variables in the `.env` file
- Install dependencies: `npm install`
- Launch your local node: `npx hardhat node`
- Deploy contract: `npx hardhat deploy-full --use-pohmock --use-test-erc20 --network localhost`

## Scripts

### Folder structure

- playground: use on local or testnet to create fake data and test the protocol
- tasks: configurable commands to use in mainnet
  - protocol: Used to managed the protocol by TalentLayer (mint a platform, allow a new arbitrator...)
  - platform: Used to managed a platform by there owner (update fee)
  - deploy: Used to deploy the protocol and his upgrades
- utils: common functions

### Commands

- run `npx hardhat` to see all the commands
- use `Makefile` for easier commands
  - `make deploy` to deploy the protocol
  - then `make setup-fakedata` to create fake data with playgrounds scripts