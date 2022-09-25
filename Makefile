install-local: deploy-local copy-configuration-local setup-fakedata-local

install-goerli: deploy-goerli copy-configuration-goerli setup-fakedata-goerli

#--------------DEPLOY----------------#

deploy-local: 
	npx hardhat deploy --use-pohmock --network localhost

deploy-goerli: 
	npx hardhat deploy --use-pohmock --network goerli

# For mac/linux users
# copy-configuration: 
# 	cp talent.config_localhost.json ../talentlayer-id-subgraph/talent.config.localhost.json
# 	cp talent.config_localhost.json ../talentlayer-id-dapp/talent.config.localhost.json

# For Windows users

#--------------COPY FILES----------------#

# For mac/linux users
# copy-configuration-local: 
# 	cp talent.config_localhost.json ../talentlayer-id-subgraph/talent.config.localhost.json
# 	cp talent.config_localhost.json ../talentlayer-id-dapp/talent.config.localhost.json

# For Windows users
copy-configuration-local: 
	Copy "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-contracts\talent.config_localhost.json" "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-dapp\src\autoconfig\talent.config_localhost.json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network localhost

copy-configuration-goerli: 
	Copy "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-contracts\talent.config_goerli.json" "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-dapp\src\autoconfig\talent.config_goerli.json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network goerli

#--------------PLAYGROUND LOCAL----------------#

setup-fakedata-local:
	npx hardhat run scripts/playground/1-mint-ID.ts --network localhost
	npx hardhat run scripts/playground/2-create-job.ts --network localhost
	npx hardhat run scripts/playground/3-make-proposal.ts --network localhost

update-proposal:
	npx hardhat run scripts/playground/4-update-proposal.ts --network localhost

reject-proposal:
	npx hardhat run scripts/playground/5-reject-proposal.ts --network localhost

accept-proposal:
	npx hardhat run scripts/playground/6-accept-proposal.ts --network localhost

pay-proposal:
	npx hardhat run scripts/playground/7-pay.ts --network localhost


#--------------PLAYGROUND GOERLI----------------#

setup-fakedata-goerli:
	npx hardhat run scripts/playground/1-mint-ID.ts --network goerli
	npx hardhat run scripts/playground/2-create-job.ts --network goerli
	timeout 40
	npx hardhat run scripts/playground/3-make-proposal.ts --network goerli
