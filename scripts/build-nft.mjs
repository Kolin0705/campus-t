import solc from 'solc';
import {readFileSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=await readFile('contracts/CampusPhotoNFT.sol','utf8');
const input={language:'Solidity',sources:{'CampusPhotoNFT.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:path=>{try{return {contents:readFileSync('node_modules/'+path,'utf8')};}catch{return {error:'Missing import '+path};}}}));
for(const e of output.errors||[]){if(e.severity==='error')throw Error(e.formattedMessage);console.log(e.formattedMessage);}
const c=output.contracts['CampusPhotoNFT.sol'].CampusPhotoNFT;
const artifact={compiler:solc.version(),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object};
if(artifact.runtime.length/2-1>24576)throw Error('Contract exceeds deployment size limit');
await mkdir('dist/contracts',{recursive:true});
await writeFile('dist/contracts/CampusPhotoNFT.json',JSON.stringify(artifact,null,2));
await writeFile('dist/contracts/CampusPhotoNFT.js','window.CAMPUS_NFT_ARTIFACT='+JSON.stringify(artifact)+';\n');
await writeFile('dist/contracts/CampusPhotoNFT.sol',source);
console.log('Built fully onchain ERC721, runtime bytes: '+(artifact.runtime.length/2-1));
