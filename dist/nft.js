/* Real testnet ERC721 transactions. No keys, mock balances or local mint permissions. */
window.campusNFT=(()=>{
 const E=ethers,A=CAMPUS_NFT_ARTIFACT,CHAIN=10143,EXPLORER='https://testnet.monadexplorer.com';
 const reader=new E.JsonRpcProvider('https://testnet-rpc.monad.xyz',CHAIN,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});
 let collection='',snapshot=null,busy=false,loading=false,message='',lastTx=null,epoch=0,role='student',wear={};
 const esc=s=>escapeHTML(String(s));
 const short=a=>a?a.slice(0,6)+'…'+a.slice(-4):'';
 const link=(kind,id,label)=>`<a href="${EXPLORER}/${kind}/${id}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
 try{const v=JSON.parse(localStorage.getItem('campus-nft-v1'))||{};collection=E.isAddress(v.collection||'')?E.getAddress(v.collection):'';wear=v.wear&&typeof v.wear==='object'?v.wear:{};if(/^0x[0-9a-fA-F]{64}$/.test(v.tx?.hash||''))lastTx=v.tx;}catch{}
 function persist(){try{localStorage.setItem('campus-nft-v1',JSON.stringify({collection,wear,tx:lastTx}));}catch{}}
 const account=()=>monad.address();
 const pending=()=>busy||lastTx?.status==='pending';
 const valid=()=>snapshot&&snapshot.collection===collection&&snapshot.account===account()&&Date.now()-snapshot.checkedAt<60000;
 const held=()=>valid()&&snapshot.balance>0n;
 const frame=()=>held()&&wear[account().toLowerCase()]===collection?'nft-light':'';
 function paint(){if(['nft','me','campus'].includes(page))render();}
 function clearWear(){if(account()){delete wear[account().toLowerCase()];persist();}}
 function error(e){const known={'Not eligible':'此钱包尚未获得 NFT 领取授权。请让品牌在 NFT 品牌端授权这个地址。','Already claimed':'此钱包已领取过本系列 NFT，转出后也不能重复领取。','Mint paused':'品牌已暂停 NFT 领取。','Sold out':'本系列已全部领完。','Owner only':'只有部署此系列的品牌钱包可以管理。'};return known[e.reason]||monad.errorMessage(e);}
 async function verified(target,provider=reader){
  if(!E.isAddress(target))throw Error('请输入品牌提供的 NFT 合约地址（0x 开头），不是钱包或 MON 奖励池地址。');
  if(BigInt(await provider.send('eth_chainId',[]))!==BigInt(CHAIN))throw Error('请使用 Monad Testnet');
  if((await provider.getCode(target)).toLowerCase()!==A.runtime.toLowerCase())throw Error('此地址不是当前版本的 CampusT 摄影 NFT 合约。请勿填写 MON 奖励池地址。');
  return new E.Contract(target,A.abi,provider);
 }
 async function refresh(){
  const ticket=++epoch;loading=true;message='正在核对测试链上的 NFT 状态…';paint();
  try{
   // Recover submitted transactions before reading the collection (including reload during deployment).
   if(lastTx?.status==='pending'){
    const r=await reader.getTransactionReceipt(lastTx.hash);
    if(r){lastTx.status=r.status===1?'confirmed':'failed';if(r.status===1&&lastTx.deploy)collection=E.getAddress(r.contractAddress);persist();}
   }
   const wallet=await monad.currentAccount();
   let next=null;
   if(collection){
    const target=collection,c=await verified(target);
    const [owner,maxSupply,totalSupply,paused,eligible,claimed,balance]=await Promise.all([c.owner(),c.maxSupply(),c.totalSupply(),c.paused(),wallet?c.eligible(wallet):false,wallet?c.claimed(wallet):false,wallet?c.balanceOf(wallet):0n]);
    let tokenId=null,image='';
    if(balance>0n){tokenId=await c.tokenOfOwnerByIndex(wallet,0);const uri=await c.tokenURI(tokenId);if(!uri.startsWith('data:application/json;base64,'))throw Error('NFT 元数据格式不符');const metadata=JSON.parse(atob(uri.split(',')[1]));if(!metadata.image?.startsWith('data:image/svg+xml;base64,'))throw Error('NFT 图片格式不符');image=metadata.image;}
    next={collection:target,account:wallet,owner,maxSupply,totalSupply,paused,eligible,claimed,balance,tokenId,image,checkedAt:Date.now()};
   }
   if(ticket!==epoch)return;
   snapshot=next;message=next?'链上状态已核实。NFT 授权与 MON 奖励池授权相互独立。':'学生请导入品牌的 NFT 领取链接；品牌可在品牌端创建系列。';
  }catch(e){if(ticket!==epoch)return;snapshot=null;message=error(e);}
  finally{if(ticket===epoch){loading=false;paint();}}
 }
 async function transact(label,create,{deploy=false}={}){
  if(pending()){message='有一笔 NFT 交易正在确认，请刷新状态或在钱包中查看，勿重复发送。';paint();return;}
  busy=true;message='请在钱包确认：'+label;paint();let submitted=false,confirmed=false;
  try{
   const s=await monad.signer();
   const tx=await create(s);submitted=true;lastTx={hash:tx.hash,label,status:'pending',deploy};persist();message='交易已提交，正在等待链上确认…';paint();
   let receipt;
   try{receipt=await tx.wait(1,120000);}catch(e){if(e.code==='TRANSACTION_REPLACED'&&!e.cancelled){receipt=e.receipt;lastTx.hash=e.replacement.hash;}else throw e;}
   if(!receipt||receipt.status!==1)throw Error('链上交易失败');
   lastTx.status='confirmed';if(deploy)collection=E.getAddress(receipt.contractAddress);persist();confirmed=true;message=label+'已确认';
  }catch(e){if(submitted&&(e.receipt||e.code==='TRANSACTION_REPLACED')){lastTx.status='failed';persist();}message=error(e)+(lastTx?.status==='pending'?' 已提交的交易仍可通过交易链接查询，请勿重复发送。':'');}
  finally{busy=false;paint();if(confirmed)await refresh();}
 }
 const writeContract=async s=>(await verified(collection,s.provider)).connect(s);
 function reason(){if(!account())return '连接学生钱包';if(!valid())return '请先导入并刷新 NFT 状态';if(snapshot.claimed)return '此钱包已领取';if(snapshot.paused)return '品牌已暂停领取';if(snapshot.totalSupply>=snapshot.maxSupply)return '本系列已领完';if(!snapshot.eligible)return '等待品牌授权 NFT';return '免费领取 NFT';}
 const canClaim=()=>valid()&&account()&&snapshot.eligible&&!snapshot.claimed&&!snapshot.paused&&snapshot.totalSupply<snapshot.maxSupply;
 const art=()=>held()?`<img src="${esc(snapshot.image)}" alt="链上读取的光迹摄影 NFT #${snapshot.tokenId}">`:'<div class="nft-preview-art"><span>LUMA × CAMPUS T</span><div class="nft-lens">◎</div><strong>CHASE THE LIGHT.</strong><small>校园摄影 · 全链上纪念藏品</small></div>';
 function ownership(){return held()?`<div class="nft-owned"><span class="nft-tag">链上已持有</span><h3>光迹摄影 #${snapshot.tokenId}</h3><p>当前钱包持有 ${snapshot.balance} 枚。展示其中一枚，均可解锁光迹头像框。</p><button class="primary full" data-nft-equip ${busy||loading?'disabled':''}>${frame()?'✓ 已穿戴链上头像框':'穿戴光迹 NFT 头像框'}</button><p class="chain-address">Token ID：${snapshot.tokenId}<br>${link('address',collection,'查看 NFT 合约')} · ${link('address',account(),'查看持有钱包')}</p></div>`:'';}
 function studentView(){return `<div class="nft-student-grid"><section class="panel nft-art-panel">${art()}${ownership()}<p class="form-note">${held()?'图片从合约 tokenURI 读取。':'图为系列预览，领取成功后展示链上编号。'} 图片、介绍与所有权均在测试链上。</p></section><section class="panel"><h2>领取你的校园记忆</h2><p class="muted">品牌核实参与资格后授权，学生用自己的钱包领取。免费铸造，仅需测试 MON 支付 Gas。</p>${importForm()}${snapshot?`<dl class="chain-stats"><div><dt>已铸造 / 上限</dt><dd>${snapshot.totalSupply} / ${snapshot.maxSupply}</dd></div><div><dt>当前钱包资格</dt><dd>${esc(reason())}</dd></div><div><dt>发放状态</dt><dd>${snapshot.paused?'已暂停':'开放领取'}</dd></div></dl><p class="chain-address">品牌钱包：${link('address',snapshot.owner,short(snapshot.owner))}<br>NFT 合约：${link('address',collection,short(collection))}</p>`:''}<button class="primary full" data-nft-claim ${!canClaim()||pending()||loading?'disabled':''}>${esc(reason())}</button><button class="text-button" data-nft-copy-wallet ${!account()?'disabled':''}>复制我的钱包地址给品牌</button>${collection?'<button class="text-button" data-nft-share>复制 NFT 领取链接</button>':''}<div class="nft-tip"><strong>已经领过 MON，为什么 NFT 还要授权？</strong><p>两种奖励使用不同合约。请让品牌在本页的「品牌端」单独授权 NFT。</p></div></section></div>`;}
 function importForm(){return `<form id="nft-import"><label>NFT 合约地址<input name="collection" placeholder="粘贴 0x 开头的 NFT 合约地址" value="${esc(collection)}" autocomplete="off" required ${pending()?'disabled':''}></label><button class="outline full" ${pending()||loading?'disabled':''}>导入并验证 NFT</button><p class="form-note">填写品牌部署后生成的 NFT 合约地址。不要填写钱包地址或 MON 奖励池地址。</p></form>`;}
 function brandView(){const own=valid()&&account()&&snapshot.owner.toLowerCase()===account().toLowerCase();return `<div class="nft-student-grid"><section class="panel"><span class="eyebrow">BRAND STUDIO</span><h2>光迹 · 校园摄影 NFT</h2><p class="muted">固定摄影主题与全链上图案，发行上限由你设置。部署此系列的钱包拥有授权管理权。</p>${!collection?`<form id="nft-deploy"><label>发行上限<input name="supply" type="number" min="1" max="10000" step="1" value="100" required></label><p class="form-note">每个钱包限领一次，上限部署后不可修改。无需预存奖励本金，部署和授权需要测试网 Gas。</p><button class="primary full" ${pending()?'disabled':''}>部署 NFT 系列到测试网</button></form>`:`${importForm()}${snapshot?`<dl class="chain-stats"><div><dt>已铸造 / 上限</dt><dd>${snapshot.totalSupply} / ${snapshot.maxSupply}</dd></div><div><dt>领取状态</dt><dd>${snapshot.paused?'已暂停':'开放领取'}</dd></div></dl><p class="chain-address">管理钱包：${link('address',snapshot.owner,short(snapshot.owner))}<br>NFT 合约：${link('address',collection,short(collection))}</p><button class="outline full" data-nft-share>复制给学生的 NFT 领取链接</button>`:''}<button class="text-button" data-nft-clear ${pending()?'disabled':''}>创建另一个系列</button>`}<details class="nft-switch"><summary>管理已有系列</summary>${!collection?importForm():'<p>在上方导入已有 NFT 合约地址即可切换。</p>'}</details></section><section class="panel"><h2>授权学生领取</h2>${own?`<form id="nft-authorize"><label>学生钱包地址<textarea name="recipients" rows="4" placeholder="每行一个 0x 地址，最多 100 个" required></textarea></label><label class="check-label"><input name="verified" type="checkbox" required>我已核实这些学生的参与资格</label><div class="chain-form-actions"><button class="primary" name="mode" value="allow" ${pending()?'disabled':''}>授权 NFT 领取</button><button class="outline" name="mode" value="revoke" ${pending()?'disabled':''}>撤销未领取资格</button></div></form><form id="nft-check"><label>查询某位学生的授权结果<input name="student" placeholder="0x…" required></label><button class="outline full" ${pending()?'disabled':''}>核对该地址的链上资格</button></form><button class="outline full" data-nft-pause ${pending()?'disabled':''}>${snapshot.paused?'恢复 NFT 领取':'暂停 NFT 领取'}</button><p class="form-note">暂停可恢复；撤销授权不会收回已铸造 NFT。</p>`:`<div class="nft-empty"><span>✧</span><h3>${!account()?'先连接品牌钱包':collection?'请连接该系列的管理钱包':'部署后，即可授权学生'}</h3><p>只有部署该 NFT 系列的钱包可以授权、撤销或暂停领取。</p></div>`}<div class="nft-tip"><strong>推荐用两个钱包测试</strong><p>A 钱包作为品牌部署并授权；B 钱包作为学生领取。两者都需要少量测试 MON 支付 Gas。</p></div></section></div>`;}
 function view(){return heading('把这一次热爱，收藏到链上。','LUMA 校园摄影 · 品牌发放，学生领取，社区穿戴')+`<section class="nft-hero"><div><span class="eyebrow">CAMPUS MEMORIES / ONCHAIN</span><h2>光迹，由你珍藏。</h2><p>ERC-721 · 全链上图案与介绍 · Monad 测试网</p></div><span class="nft-hero-mark" aria-hidden="true">◎</span></section><div class="nft-role" role="group" aria-label="选择测试角色"><button data-nft-role="student" class="${role==='student'?'selected':''}" aria-pressed="${role==='student'}">学生端 · 领取 NFT</button><button data-nft-role="brand" class="${role==='brand'?'selected':''}" aria-pressed="${role==='brand'}">品牌端 · 发放 NFT</button></div><div class="chain-toolbar"><button class="primary" data-chain-connect>${account()?short(account())+' · 切换钱包':'连接测试网钱包'}</button><button class="outline" data-nft-refresh ${busy||loading?'disabled':''}>${loading?'核对中…':'刷新链上状态'}</button><span>MONAD TESTNET · 10143</span></div><div class="chain-message" role="status">${esc(message||'先连接钱包，再选择你的测试角色。')}</div>${lastTx?`<div class="chain-tx">${esc(lastTx.label)} · ${lastTx.status==='confirmed'?'链上已确认':lastTx.status==='failed'?'失败或已取消':'等待确认'} ${link('tx',lastTx.hash,'查看交易')}</div>`:''}<div class="nft-body">${role==='student'?studentView():brandView()}</div><p class="nft-footnote">NFT 可转赠，穿戴资格随当前持有者变化；持有不等于本人到场。默认免费装扮与积分仍为本地体验。<a href="contracts/CampusPhotoNFT.sol" target="_blank" rel="noopener">查看 NFT 合约源码</a></p>`;}
 function renderPage(){if(page!=='nft')return false;stopCamera();onsiteHeader('链上 NFT');$('#content').innerHTML=view();return true;}
 function wardrobe(){return `<section class="wardrobe-group"><div class="section-head"><div><h2>链上藏品</h2><p>连接钱包，验证并穿戴摄影活动 NFT。</p></div><button class="outline" data-page="nft">领取与管理 NFT</button></div>${held()?`<div class="nft-wardrobe-card"><img src="${esc(snapshot.image)}" alt="光迹 NFT #${snapshot.tokenId}"><div><span class="nft-tag">Monad 测试网 · 已核实持有</span><h3>光迹摄影 #${snapshot.tokenId}</h3><p>光迹限定头像框 · 当前钱包持有 ${snapshot.balance} 枚</p><button class="primary" data-nft-equip>${frame()?'✓ 正在穿戴':'穿戴链上头像框'}</button></div></div>`:`<div class="wardrobe-note"><p>${account()?'导入 NFT 合约并刷新链上状态后，持有的装扮会出现在这里。':'连接真实钱包后查看链上藏品。免费装扮无需连接钱包。'}</p><button class="text-button" data-page="nft">打开 NFT 学生端</button></div>`}</section>`;}
 async function run(fn){try{await fn();}catch(e){message=error(e);paint();toast(message);}}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.nftRole){role=d.nftRole==='brand'?'brand':'student';paint();}
  if('nftRefresh'in d)run(refresh);
  if('nftClaim'in d)run(()=>transact('领取光迹 NFT',async s=>{const c=await writeContract(s);await c.claim.staticCall();return c.claim({chainId:CHAIN});}));
  if('nftPause'in d&&valid()){const value=!snapshot.paused;run(()=>transact(value?'暂停 NFT 领取':'恢复 NFT 领取',async s=>(await writeContract(s)).setPaused(value,{chainId:CHAIN})));}
  if('nftClear'in d&&!pending()){epoch++;collection='';snapshot=null;persist();paint();}
  if('nftShare'in d)run(()=>navigator.clipboard.writeText(PUBLIC_ORIGIN+'/#nft?collection='+collection).then(()=>toast('NFT 领取链接已复制')));
  if('nftCopyWallet'in d)run(()=>navigator.clipboard.writeText(account()).then(()=>toast('学生钱包地址已复制')));
  if('nftEquip'in d)run(async()=>{await refresh();if(!held())throw Error('当前钱包未持有此 NFT，或链上验证未完成');wear[account().toLowerCase()]=collection;persist();paint();toast('已穿戴链上光迹头像框，社区名片同步展示');});
  if(d.equip||'resetDress'in d){clearWear();paint();}
 });
 document.addEventListener('submit',e=>{const f=e.target;if(!['nft-import','nft-deploy','nft-authorize','nft-check'].includes(f.id))return;e.preventDefault();if(pending())return;const fd=new FormData(f),mode=e.submitter?.value;
  run(async()=>{
   if(f.id==='nft-import'){const target=String(fd.get('collection')).trim();await verified(target);epoch++;collection=E.getAddress(target);snapshot=null;persist();await refresh();}
   if(f.id==='nft-deploy'){const supply=String(fd.get('supply'));if(!/^\d+$/.test(supply)||Number(supply)<1||Number(supply)>10000)throw Error('发行上限需为 1 至 10000 的整数');await transact('部署摄影 NFT 系列',async s=>(await new E.ContractFactory(A.abi,A.bytecode,s).deploy(BigInt(supply),{chainId:CHAIN})).deploymentTransaction(),{deploy:true});}
   if(f.id==='nft-authorize'){if(!fd.has('verified'))throw Error('请先核实参与资格');const entries=String(fd.get('recipients')).split(/[\s,;，；]+/).filter(Boolean);if(!entries.length||entries.some(a=>!E.isAddress(a)||a===E.ZeroAddress))throw Error('请填写有效学生钱包地址');const list=[...new Set(entries.map(a=>E.getAddress(a)))];if(list.length>100)throw Error('每次最多授权 100 个地址');const allow=mode!=='revoke';await transact(allow?'授权 NFT 领取':'撤销 NFT 资格',async s=>(await writeContract(s)).setEligible(list,allow,{chainId:CHAIN}));}
   if(f.id==='nft-check'){const student=String(fd.get('student')).trim();if(!E.isAddress(student)||student===E.ZeroAddress)throw Error('请输入有效学生地址');const c=await verified(collection);const [eligible,claimed,balance]=await Promise.all([c.eligible(student),c.claimed(student),c.balanceOf(student)]);message=`查询 ${E.getAddress(student)}：${eligible?'NFT 已授权':'NFT 未授权'}；${claimed?'已领取过':'尚未领取'}；当前持有 ${balance} 枚。`;paint();}
  });
 });
 function route(){const match=location.hash.match(/^#nft(?:\?(.*))?$/);if(!match)return;page='nft';const params=new URLSearchParams(match[1]||'');role=params.get('role')==='brand'?'brand':'student';const target=params.get('collection');if(target&&!pending()){if(!E.isAddress(target)){message='分享链接中的 NFT 地址无效';paint();return;}collection=E.getAddress(target);snapshot=null;persist();}paint();run(refresh);}
 window.addEventListener('hashchange',route);
 window.addEventListener('campus-wallet-change',()=>{epoch++;snapshot=null;paint();run(refresh);});
 const editing=()=>!!document.querySelector('#content form:focus-within');
 window.addEventListener('focus',()=>{if(collection&&account()&&!busy&&!loading&&!editing())run(refresh);});
 setInterval(()=>{if(collection&&account()&&!busy&&!loading&&!editing()&&document.visibilityState==='visible')run(refresh);},30000);
 return {renderPage,route,refresh,frame,wardrobe,clearWear};
})();
render();campusNFT.route();
