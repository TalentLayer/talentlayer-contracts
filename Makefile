#!make
include .env

#--------------FULL INSTALLATION----------------#

install: deploy copy-configuration setup-fakedata

#--------------DEPLOY----------------#

deploy: 
	npx hardhat deploy --use-pohmock --network $(DEPLOY_NETWORK)

#--------------COPY FILES----------------#


ifeq ($(OS),Windows_NT)
copy-configuration: 
	Copy "$(CONTRACTS_FOLDER)\talent.config_$(DEPLOY_NETWORK).json" "$(DAPP_FOLDER)\src\autoconfig\talent.config_$(DEPLOY_NETWORK).json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)
else
copy-configuration: 
	cp talent.config_localhost.json ../talentlayer-id-subgraph/talent.config.localhost.json
	cp talent.config_localhost.json ../talentlayer-id-dapp/talent.config.localhost.json
endif


#--------------PLAYGROUND LOCAL----------------#

setup-fakedata:
	timeout 20
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	timeout 30
	npx hardhat run scripts/playground/2-create-job.ts --network $(DEPLOY_NETWORK)
	timeout 30
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)

update-proposal:
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)

reject-proposal:
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)

accept-proposal:
	npx hardhat run scripts/playground/6-accept-proposal.ts --network $(DEPLOY_NETWORK)

pay-proposal:
	npx hardhat run scripts/playground/7-pay.ts --network $(DEPLOY_NETWORK)

