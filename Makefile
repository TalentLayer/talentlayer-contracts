install: deploy copy-configuration setup-fakedata

deploy: 
	npx hardhat deploy --use-pohmock --network localhost

# For mac/linux users
# copy-configuration: 
# 	cp talent.config_localhost.json ../talentlayer-id-subgraph/talent.config.localhost.json
# 	cp talent.config_localhost.json ../talentlayer-id-dapp/talent.config.localhost.json

# For Windows users
copy-configuration: 
	Copy "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-contracts\talent.config_localhost.json" "C:\Users\Martin\OneDrive\Bureau\TalentLayer\talentlayer-id-dapp\src\autoconfig\talent.config_localhost.json"
	npx hardhat run scripts/setSubgraphNetwork.ts --network localhost

setup-fakedata:
	npx hardhat run scripts/playground/1-mint-ID.ts --network localhost
	npx hardhat run scripts/playground/2-create-job.ts --network localhost
	npx hardhat run scripts/playground/3-make-proposal.ts --network localhost

