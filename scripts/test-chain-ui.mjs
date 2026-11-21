import ganache from 'ganache';
import {writeFile} from 'node:fs/promises';
const server=ganache.server({chain:{chainId:10143,hardfork:'shanghai'},wallet:{totalAccounts:3,defaultBalance:10},logging:{quiet:true}});await server.listen(8547,'127.0.0.1');
let ws;
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:9227/json/list')).json();if(tabs.some(t=>t.type==='page'))break;}catch{}await new Promise(r=>setTimeout(r,200));}
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',ev=>{const d=JSON.parse(ev.data);if(d.id){pending.get(d.id)(d);pending.delete(d.id);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value;};
 const wait=async expression=>{for(let i=0;i<250;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout '+expression+' '+await ev("document.body.innerText.slice(-1500)"));};
 const click=s=>ev(`document.querySelector(${JSON.stringify(s)}).click()`);const assert=(v,s)=>{if(!v)throw Error(s);console.log('PASS '+s);};
 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>nativeFetch(String(input).includes('testnet-rpc.monad.xyz')?'http://127.0.0.1:8547':input,init);window.testAccount=0;const handlers={};window.ethereum={on:(k,f)=>handlers[k]=f,removeListener:k=>delete handlers[k],request:async({method,params=[]})=>{if(method==='wallet_switchEthereumChain'||method==='wallet_addEthereumChain')return null;const account=method==='eth_requestAccounts'||method==='eth_accounts';const r=await nativeFetch('http://127.0.0.1:8547',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:account?'eth_accounts':method,params})}).then(r=>r.json());if(r.error)throw Object.assign(new Error(r.error.message),r.error);return account?[r.result[window.testAccount]]:r.result;}};window.switchTestAccount=i=>{window.testAccount=i;handlers.accountsChanged?.([]);};`});
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'file:///E:/campusT/campus-demo/dist/index.html#monad'});await wait("typeof monad!=='undefined'");await ev("localStorage.removeItem('campus-monad-v1');location.reload()");await wait("document.querySelector('#pool-deploy')!==null");
 await click('[data-chain-connect]');await click('[data-wallet-provider]');await wait("document.querySelector('#wallet').textContent.includes('…')");
 await ev("document.querySelector('#pool-deploy [name=budget]').value='0.003';document.querySelector('#pool-deploy').requestSubmit()");await wait("document.querySelector('#pool-authorize')!==null");assert(true,'wallet deploy and funded pool');
 const student=await server.provider.request({method:'eth_accounts',params:[]}).then(x=>x[1]);
 await ev(`document.querySelector('#pool-authorize textarea').value='${student}';document.querySelector('#pool-authorize [name=verified]').checked=true;document.querySelector('#pool-authorize').requestSubmit(document.querySelector('#pool-authorize [value=allow]'))`);await wait("document.querySelector('.chain-tx').textContent.includes('授权参与者领取 · 链上已确认')");
 await ev('switchTestAccount(1)');await click('[data-chain-refresh]');await wait("!document.querySelector('[data-chain-claim]').disabled");
 await click('[data-chain-claim]');await wait("document.querySelector('[data-chain-claim]').textContent.includes('已领取')");assert(await ev("document.querySelector('[data-chain-claim]').disabled"),'student claims once; receipt confirms');
 await ev('switchTestAccount(2)');await click('[data-chain-refresh]');await wait("document.querySelector('.chain-stats')?.textContent.includes('等待品牌授权')");assert(await ev("document.querySelector('[data-chain-claim]').disabled"),'unapproved account cannot claim');
 await ev("document.querySelector('#pool-import input').value='0x0000000000000000000000000000000000000001';document.querySelector('#pool-import').requestSubmit()");await wait("document.querySelector('.chain-message').textContent.includes('不是当前版本')");assert(true,'foreign pool address rejected');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await ev('document.documentElement.scrollWidth<=innerWidth'),'mobile reward page fits');
 const img=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('E:/campusT/monad-mobile.png',Buffer.from(img.result.data,'base64'));
 assert(errors.length===0,'no browser runtime exceptions');await cdp('Browser.close');
}finally{ws?.close();await server.close();}
