#!make
include .env


#--------------FULL INSTALLATION----------------#

install: deploy  setup-fakedata

allScripts: deploy copy-configuration setup-allFakeData

#--------------DEPLOY----------------#

deploy: 
	npx hardhat deploy --use-pohmock --use-test-erc20 --network $(DEPLOY_NETWORK)

deploy-verify: 
	npx hardhat deploy --use-pohmock --use-test-erc20 --verify --network $(DEPLOY_NETWORK)

#--------------COPY FILES----------------#


ifeq ($(OS),Windows_NT)
copy-configuration: 
	# Copy "$(CONTRACTS_FOLDER)\talent.config_$(DEPLOY_NETWORK).json" "$(DAPP_FOLDER)\src\config\talent.config_$(DEPLOY_NETWORK).json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)
else
copy-configuration: 
	# cp "$(CONTRACTS_FOLDER)/talent.config_$(DEPLOY_NETWORK).json" "$(DAPP_FOLDER)/src/config/talent.config_$(DEPLOY_NETWORK).json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)
endif

#--------------PLAYGROUND LOCAL----------------#

wait_localhost = 1
wait_other_network = 1

ifeq ($(DEPLOY_NETWORK),localhost)
	w := $(wait_localhost)
else
	w := $(wait_other_network)
endif


ifeq ($(OS),Windows_NT)
setup-fakedata:
	timeout $(w)
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
else
setup-fakedata:
	sleep $(w)
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
endif

ifeq ($(OS),Windows_NT)
setup-allFakeData:
	timeout $(w)
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/2-update-service.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/6-accept-ETHproposal.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/6-accept-tokenProposal.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/7-payETH.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/7-payToken.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/8-reviews.ts --network $(DEPLOY_NETWORK)
	timeout $(w)
	npx hardhat run scripts/playground/9-claim.ts --network $(DEPLOY_NETWORK)
else
setup-allFakeData:
	sleep $(w)
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/2-update-service.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/6-accept-ETHproposal.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/6-accept-tokenProposal.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/7-payETH.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/7-payToken.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/8-reviews.ts --network $(DEPLOY_NETWORK)
	sleep $(w)
	npx hardhat run scripts/playground/9-claim.ts --network $(DEPLOY_NETWORK)
endif

mint-platformid:
	npx hardhat run scripts/playground/0-mint-platform-ID.ts --network $(DEPLOY_NETWORK)

mint-id:
	npx hardhat run scripts/playground/1-mint-ID.ts --network $(DEPLOY_NETWORK)

create-service:
	npx hardhat run scripts/playground/2-create-service.ts --network $(DEPLOY_NETWORK)

update-service:
	npx hardhat run scripts/playground/2-update-service.ts --network $(DEPLOY_NETWORK)

make-proposal:
	npx hardhat run scripts/playground/3-make-proposal.ts --network $(DEPLOY_NETWORK)

update-proposal:
	npx hardhat run scripts/playground/4-update-proposal.ts --network $(DEPLOY_NETWORK)

reject-proposal:
	npx hardhat run scripts/playground/5-reject-proposal.ts --network $(DEPLOY_NETWORK)

accept-ETHproposal:
	npx hardhat run scripts/playground/6-accept-ETHproposal.ts --network $(DEPLOY_NETWORK)

accept-tokenProposal:
	npx hardhat run scripts/playground/6-accept-tokenProposal.ts --network $(DEPLOY_NETWORK)

pay-ETHproposal:
	npx hardhat run scripts/playground/7-payETH.ts --network $(DEPLOY_NETWORK)

pay-tokenProposal:
	npx hardhat run scripts/playground/7-payToken.ts --network $(DEPLOY_NETWORK)

reviews:
	npx hardhat run scripts/playground/8-reviews.ts --network $(DEPLOY_NETWORK)

claim-balance:
	npx hardhat run scripts/playground/9-claim.ts --network $(DEPLOY_NETWORK)

