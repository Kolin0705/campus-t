import solc from 'solc';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
const source=await readFile('contracts/CampusRewardPool.sol','utf8');
const input={language:'Solidity',sources:{'CampusRewardPool.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
for(const e of output.errors||[]){if(e.severity==='error')throw Error(e.formattedMessage);console.log(e.formattedMessage);}
const c=output.contracts['CampusRewardPool.sol'].CampusRewardPool;
const artifact={compiler:solc.version(),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object};
await mkdir('dist/vendor',{recursive:true});await mkdir('dist/contracts',{recursive:true});
await writeFile('dist/contracts/CampusRewardPool.json',JSON.stringify(artifact,null,2));
await writeFile('dist/contracts/CampusRewardPool.js','window.CAMPUS_POOL_ARTIFACT='+JSON.stringify(artifact)+';\n');
await writeFile('dist/contracts/CampusRewardPool.sol',source);
await copyFile('node_modules/ethers/dist/ethers.umd.min.js','dist/vendor/ethers.umd.min.js');
await copyFile('node_modules/ethers/LICENSE.md','dist/vendor/ethers-LICENSE.md');
console.log('Built testnet pool with '+artifact.compiler);
