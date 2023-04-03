# TalentLayer

An interoperable identity system for freelancing marketplaces. Leverage one unified, self-owned, identity across many freelancing marketplaces. Realize #WorkSovereignty by owning your work reputation.

Learn more about the project: https://www.talentlayer.org

## Documentations

_Our documentations are in Notion and Gitbook. Here are some links to the most important pages:_

Start integrating TalentLayer:

- The complete official user documentation: https://docs.talentlayer.org

Understand the protocol and how we tackle our main problems:

- TLIP Index: https://talentlayer.notion.site/TLIP-83015d793d9d48818914f8cac3c08231

## Deployment addresses:

- [Mumbai](./.deployment/mumbai.json)

## Audits 

- Internal: https://talentlayer.notion.site/TLIP-0002-Security-Assessment-782ab9e80d774749811adfc61cbb7622
- Externals: 
  - Bios42: https://github.com/bios42eth/talenlayer-id-report
  - Ahmet: https://github.com/ahmedovv123/audits/blob/main/audits/TalentLayer.md

## Setup locally

- Create your env file config: `mv .env.example .env`
- Complete all the variables in the `.env` file
- Install dependencies: `npm install`
- Launch your local node: `npx hardhat node`
- Deploy contract: `npx hardhat deploy-full --use-test-erc20 --network localhost`

## Tests 

### Coverage

<img width="648" alt="image" src="https://user-images.githubusercontent.com/747152/228285991-de2efaac-f078-4942-8785-1dba88d76984.png">

- [Searching for something else ? Congrats you've found an easter egg!](https://claim.talentlayer.org/images/ee/DW8lwIQyDr.jpg)

### Run

- `npx hardhat test`

## Scripts

### Folder structure

- playground: use on local or testnet to create fake data and test the protocol
- tasks: configurable commands to use in mainnet
  - protocol: Used to manage the protocol by TalentLayer (mint a platform, allow a new arbitrator...)
  - platform: Used to manage a platform by there owner (update fee)
  - deploy: Used to deploy the protocol and his upgrades
- utils: common functions

### Commands

- run `npx hardhat` to see all the commands
- use `Makefile` for easier commands
  - `make deploy` to deploy the protocol
  - then `make setup-fakedata` to create fake data with playgrounds scripts
