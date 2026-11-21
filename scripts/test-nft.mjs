import ganache from 'ganache';
import {ethers} from 'ethers';
import solc from 'solc';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const artifact=JSON.parse(await readFile('dist/contracts/CampusPhotoNFT.json','utf8'));
const rpc=ganache.provider({chain:{chainId:10143,hardfork:'shanghai'},wallet:{totalAccounts:6,defaultBalance:20},logging:{quiet:true}});
const provider=new ethers.BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
try{
 const owner=await provider.getSigner(0),alice=await provider.getSigner(1),bob=await provider.getSigner(2),charlie=await provider.getSigner(3);
 const a=await alice.getAddress(),b=await bob.getAddress(),c=await charlie.getAddress();
 const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,owner);
 await assert.rejects(factory.deploy(0));await assert.rejects(factory.deploy(10001));
 const nft=await factory.deploy(2);await nft.waitForDeployment();
 assert.equal(await provider.getCode(nft.target),artifact.runtime);
 assert.equal(await nft.supportsInterface('0x80ac58cd'),true);assert.equal(await nft.supportsInterface('0x5b5e139f'),true);assert.equal(await nft.supportsInterface('0x780e9d63'),true);
 await assert.rejects(nft.connect(alice).claim.staticCall());await assert.rejects(nft.connect(alice).setEligible.staticCall([a],true));await assert.rejects(nft.connect(alice).setPaused.staticCall(true));
 await assert.rejects(nft.setEligible.staticCall([],true));await assert.rejects(nft.setEligible.staticCall([ethers.ZeroAddress],true));await assert.rejects(nft.setEligible.staticCall(Array(101).fill(a),true));
 await(await nft.setEligible([a,b,c],true)).wait();await(await nft.setEligible([b],false)).wait();await assert.rejects(nft.connect(bob).claim.staticCall());
 await(await nft.setPaused(true)).wait();await assert.rejects(nft.connect(alice).claim.staticCall());await(await nft.setPaused(false)).wait();
 await(await nft.connect(alice).claim()).wait();assert.equal(await nft.ownerOf(1),a);assert.equal(await nft.balanceOf(a),1n);assert.equal(await nft.claimed(a),true);
 await assert.rejects(nft.connect(alice).claim.staticCall());
 const metadata=JSON.parse(Buffer.from((await nft.tokenURI(1)).split(',')[1],'base64').toString());assert.match(metadata.name,/#1$/);assert.match(metadata.image,/^data:image\/svg\+xml;base64,/);
 const svg=Buffer.from(metadata.image.split(',')[1],'base64').toString();assert.match(svg,/MONAD TESTNET \/ #1/);
 await assert.rejects(nft.tokenURI(2));
 await assert.rejects(nft.connect(bob).transferFrom.staticCall(a,b,1));
 await(await nft.connect(alice)['safeTransferFrom(address,address,uint256)'](a,b,1)).wait();assert.equal(await nft.balanceOf(a),0n);assert.equal(await nft.tokenOfOwnerByIndex(b,0),1n);await assert.rejects(nft.connect(alice).claim.staticCall());
 await(await nft.setEligible([b],true)).wait();await(await nft.connect(bob).claim()).wait();assert.equal(await nft.balanceOf(b),2n);assert.equal(await nft.totalSupply(),2n);await assert.rejects(nft.connect(charlie).claim.staticCall());
 console.log('PASS: ERC721 interfaces, runtime verification, supply limits, owner access, authorization/revocation, pause/resume, free claim, duplicate prevention, metadata/SVG, transfers and sold-out.');
 // A receiver that attempts a second mint during the safe-mint callback must not obtain it.
 const source='pragma solidity ^0.8.30; interface N {function claim() external;} contract Receiver {N n; bool public blocked; constructor(address t){n=N(t);} function mint() external {n.claim();} function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){try n.claim(){revert("Double mint");}catch{blocked=true;} return 0x150b7a02;}}';
 const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'R.sol':{content:source}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
 const ca=output.contracts['R.sol'].Receiver,second=await factory.deploy(10);await second.waitForDeployment();
 const receiver=await new ethers.ContractFactory(ca.abi,'0x'+ca.evm.bytecode.object,owner).deploy(second.target);await receiver.waitForDeployment();
 await(await second.setEligible([receiver.target],true)).wait();await(await receiver.mint()).wait();assert.equal(await receiver.blocked(),true);assert.equal(await second.balanceOf(receiver.target),1n);
 console.log('PASS: ERC721 receiver callback cannot mint twice.');
 const wrong=ganache.provider({chain:{chainId:143},logging:{quiet:true}});try{const wp=new ethers.BrowserProvider(wrong);await assert.rejects(new ethers.ContractFactory(artifact.abi,artifact.bytecode,await wp.getSigner()).deploy(100));}finally{await wrong.disconnect();}
 console.log('PASS: mainnet deployment rejected by the contract.');
}finally{await rpc.disconnect();}
