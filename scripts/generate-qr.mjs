import QRCode from 'qrcode';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const base='https://campus-t-kolin-demo.lacyalbatross5.chatgpt.site/';
await mkdir('dist/assets',{recursive:true});await mkdir('dist/vendor',{recursive:true});
await copyFile('node_modules/jsqr/dist/jsQR.js','dist/vendor/jsQR.js');
await copyFile('node_modules/jsqr/LICENSE','dist/vendor/jsQR-LICENSE.txt');
for(const [action,label,sub] of [['checkin','活动参与码','扫码报名并签到'],['checkout','活动签退码','已签到后，扫码签退领取奖励']]){
 const url=base+'#attend/photo-walk/'+action;
 const opts={errorCorrectionLevel:'M',margin:4,width:960,color:{dark:'#263A32',light:'#FFFFFF'}};
 await QRCode.toFile(`dist/assets/photo-${action}.png`,url,opts);
 const svg=await QRCode.toString(url,{...opts,type:'svg'});
 await writeFile(`dist/assets/photo-${action}.svg`,svg);
 const inset=svg.replace(/<svg[^>]*>/,'<svg x="100" y="220" width="600" height="600" viewBox="'+svg.match(/viewBox="([^"]+)"/)[1]+'">');
 const poster=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1080" viewBox="0 0 800 1080"><rect width="800" height="1080" fill="#F6F7F1"/><rect x="24" y="24" width="752" height="1032" rx="28" fill="none" stroke="#B6C3A7" stroke-width="2"/><g text-anchor="middle" fill="#354C40" font-family="Arial,Microsoft YaHei,sans-serif"><text x="400" y="85" font-size="20" letter-spacing="5">LUMA × CAMPUS T</text><text x="400" y="145" font-size="36" font-weight="700">把校园拍成明信片</text><text x="400" y="192" font-size="22">校园摄影漫游 · ${label}</text>${inset}<text x="400" y="864" font-size="28" font-weight="700">${sub}</text><text x="400" y="916" font-size="20">完成签到 + 签退，领取 100 积分与限定头像框</text><text x="400" y="970" font-size="17" fill="#7F8D7F">演示活动 · 记录仅保存在当前浏览器</text><text x="400" y="1013" font-size="15" fill="#7F8D7F">请使用同一浏览器完成两次扫码</text></g></svg>`;
 await writeFile(`dist/assets/photo-${action}-poster.svg`,poster);
 console.log(action+': '+url);
}
