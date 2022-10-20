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
	timeout 5
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	timeout 5
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	timeout 5
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	timeout 5
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
else
setup-fakedata:
	sleep 5
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	sleep 5
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	sleep 5
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	sleep 5
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
endif

mint-platformid:
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)

mint-id:
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)

create-service:
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)

make-proposal:
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)

update-proposal:
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)

reject-proposal:
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)

accept-proposal:
	npx hardhat run scripts/playground/6-accept-proposal.ts --network $(DEPLOY_NETWORK)

pay-proposal:
	npx hardhat run scripts/playground/7-pay.ts --network $(DEPLOY_NETWORK)

reviews:
	npx hardhat run scripts/playground/8-reviews.ts --network $(DEPLOY_NETWORK)

