#!make
include .env

#--------------FULL INSTALLATION FOR LOCALHOST ENV----------------#

install: deploy-localhost setup-fakedata

install-full: deploy-localhost setup-allFakeData

#--------------UTILS----------------#

clean: 
	npx hardhat clean

tests:
	make clean
	npx hardhat test

#--------------DEPLOY----------------#

deploy-mumbai: 
	make clean
	npx hardhat deploy-full --network mumbai --verify
	npx hardhat initial-setup --network mumbai

deploy-fuji: 
	make clean
	npx hardhat deploy-full --network fuji --verify
	npx hardhat initial-setup --network fuji

deploy-localhost: 
	make clean
	npx hardhat deploy-full --use-test-erc20 --network localhost
	npx hardhat initial-setup --network localhost

deploy: 
	npx hardhat deploy-full --use-test-erc20 --network $(DEPLOY_NETWORK)

deploy-verify: 
	npx hardhat deploy-full --use-test-erc20 --verify --network $(DEPLOY_NETWORK)

#--------------GRAPH----------------#

update-graph-config: graph-copy-abis graph-copy-address

ifeq ($(OS),Windows_NT)
graph-copy-abis:
	Copy "artifacts\contracts\TalentLayerID.sol\TalentLayerID.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerID.json"
	Copy "artifacts\contracts\TalentLayerPlatformID.sol\TalentLayerPlatformID.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerPlatformID.json"
	Copy "artifacts\contracts\TalentLayerService.sol\TalentLayerService.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerService.json"
	Copy "artifacts\contracts\TalentLayerEscrow.sol\TalentLayerEscrow.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerEscrow.json"
	Copy "artifacts\contracts\TalentLayerReview.sol\TalentLayerReview.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerReview.json"
	Copy "artifacts\contracts\TalentLayerArbitrator.sol\TalentLayerArbitrator.json" "$(SUBGRAPH_FOLDER)\abis\TalentLayerArbitrator.json"
else
graph-copy-abis:
	cp artifacts\contracts\TalentLayerID.sol\TalentLayerID.json $(SUBGRAPH_FOLDER)\abis\TalentLayerID.json
	cp artifacts/contracts/TalentLayerPlatformID.sol/TalentLayerPlatformID.json $(SUBGRAPH_FOLDER)/abis/TalentLayerPlatformID.json
	cp artifacts/contracts/TalentLayerService.sol/TalentLayerService.json $(SUBGRAPH_FOLDER)/abis/TalentLayerService.json
	cp artifacts/contracts/TalentLayerEscrow.sol/TalentLayerEscrow.json $(SUBGRAPH_FOLDER)/abis/TalentLayerEscrow.json
	cp artifacts/contracts/TalentLayerReview.sol/TalentLayerReview.json $(SUBGRAPH_FOLDER)/abis/TalentLayerReview.json
	cp artifacts/contracts/TalentLayerArbitrator.sol/TalentLayerArbitrator.json $(SUBGRAPH_FOLDER)/abis/TalentLayerArbitrator.json
endif

graph-copy-address: 
	npx hardhat run scripts/utils/setSubgraphNetwork.ts --network $(DEPLOY_NETWORK)

#--------------INDIE FRONTEND----------------#

update-frontend-config: frontend-copy-abis

ifeq ($(OS),Windows_NT)
frontend-copy-abis:
	Copy "artifacts\contracts\TalentLayerID.sol\TalentLayerID.json" "..\indie-frontend\src\contracts\ABI\TalentLayerID.json"
	Copy "artifacts\contracts\TalentLayerPlatformID.sol\TalentLayerPlatformID.json" "..\indie-frontend\src\contracts\ABI\TalentLayerPlatformID.json"
	Copy "artifacts\contracts\TalentLayerService.sol\TalentLayerService.json" "..\indie-frontend\src\contracts\ABI\TalentLayerService.json"
	Copy "artifacts\contracts\TalentLayerEscrow.sol\TalentLayerEscrow.json" "..\indie-frontend\src\contracts\ABI\TalentLayerEscrow.json"
	Copy "artifacts\contracts\TalentLayerReview.sol\TalentLayerReview.json" "..\indie-frontend\src\contracts\ABI\TalentLayerReview.json"
	Copy "artifacts\contracts\TalentLayerArbitrator.sol\TalentLayerArbitrator.json" "..\indie-frontend\src\contracts\ABI\TalentLayerArbitrator.json"
else:
	cp artifacts/contracts/TalentLayerID.sol/TalentLayerID.json ../indie-frontend/src/contracts/ABI/TalentLayerID.json
	cp artifacts/contracts/TalentLayerPlatformID.sol/TalentLayerPlatformID.json ../indie-frontend/src/contracts/ABI/TalentLayerPlatformID.json
	cp artifacts/contracts/TalentLayerService.sol/TalentLayerService.json ../indie-frontend/src/contracts/ABI/TalentLayerService.json
	cp artifacts/contracts/TalentLayerEscrow.sol/TalentLayerEscrow.json ../indie-frontend/src/contracts/ABI/TalentLayerEscrow.json
	cp artifacts/contracts/TalentLayerReview.sol/TalentLayerReview.json ../indie-frontend/src/contracts/ABI/TalentLayerReview.json
	cp artifacts/contracts/TalentLayerArbitrator.sol/TalentLayerArbitrator.json ../indie-frontend/src/contracts/ABI/TalentLayerArbitrator.json
endif

#--------------PLAYGROUND LOCAL----------------#

wait_localhost = 0
wait_other_network = 60

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

dispute/setup:
	npx hardhat run scripts/playground/disputeResolution/0-setup.ts --network $(DEPLOY_NETWORK)

dispute/pay-arbitration-fee:
	npx hardhat run scripts/playground/disputeResolution/1-pay-arbitration-fee.ts --network $(DEPLOY_NETWORK)

dispute/create-dispute:
	npx hardhat run scripts/playground/disputeResolution/2-create-dispute.ts --network $(DEPLOY_NETWORK)

dispute/submit-evidence:
	npx hardhat run scripts/playground/disputeResolution/3-submit-evidence.ts --network $(DEPLOY_NETWORK)

dispute/submit-ruling:
	npx hardhat run scripts/playground/disputeResolution/4-submit-ruling.ts --network $(DEPLOY_NETWORK)