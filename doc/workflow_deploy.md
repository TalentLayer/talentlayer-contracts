
## Workflow

> **Step 1 : Contract deployment**

- Check if all the .env variable is complete
- select the network by changing the variable DEPLOY_NETWORK =...
- Run the  make command you want
  - add : ``--use-pohmock`` will use the POH Mock
  - add : `` --use-test-erc20`` will deploy a ERC20 token
  - add : `` --verify `` will verify the contract on the network scan
 ex : run make deploy will deploy the contract, use pOH Mock and deploy an ERC20 token
 - Add the deployed contract address in the README.md file

> **Step 2 : Subgraph setup**
> > **Step 2.1 : Check list**

- Check if your abis are up to date and match with the deployed contract
- Add the deployed contract addresses to the network.json file (in the corresponding network object) & select your start block
- Check that the Graph-CLI is well install (if issue using graph command, please install it globally)
- Check the make file command (if the make regenerate doesn't work correctly please launch the graph command individualy)
- Create an account on The Graph platform then create a new subgraph then get your access token

>> **Step 2.2 : Run command before deploy your subgraph**
>> 
WARN !! : 

if the npm command or make command doesn't work correctly please launch the full graph command

ex : launch graph build --network <yourNetwork> instead npm run build
  
- ``graph codegen`` (it will generate the generated folder)
- `` graph build --network <you rNetwork>`` (it will generate the build folder and add the network.json addresses in the subgraph.yaml)
- if you deploy you graph for the first time please authenticated yourself with the commad just below
  - ``graph auth --network <your Network> --product hosted-service <your access token>`` 
- `` graph deploy --product hosted-service <path of your subgraph>
  
 After the last command you should see on your subgraph dashboard some deployment logs
  
 
  
