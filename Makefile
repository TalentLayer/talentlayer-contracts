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
	Copy "$(CONTRACTS_FOLDER)\talent.config_$(DEPLOY_NETWORK).json" "$(DAPP_FOLDER)\src\config\talent.config_$(DEPLOY_NETWORK).json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)
else
copy-configuration: 
	cp "$(CONTRACTS_FOLDER)/talent.config_$(DEPLOY_NETWORK).json" "$(DAPP_FOLDER)/src/config/talent.config_$(DEPLOY_NETWORK).json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)
endif




#--------------PLAYGROUND LOCAL----------------#

ifeq ($(OS),Windows_NT)
setup-fakedata:
	timeout 20
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	timeout 30
	npx hardhat run scripts/playground/2-create-job.ts --network $(DEPLOY_NETWORK)
	timeout 30
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
else
setup-fakedata:
	sleep 20
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	sleep 30
	npx hardhat run scripts/playground/2-create-job.ts --network $(DEPLOY_NETWORK)
	sleep 30
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
endif

update-proposal:
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)

reject-proposal:
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)

accept-proposal:
	npx hardhat run scripts/playground/6-accept-proposal.ts --network $(DEPLOY_NETWORK)

pay-proposal:
	npx hardhat run scripts/playground/7-pay.ts --network $(DEPLOY_NETWORK)

