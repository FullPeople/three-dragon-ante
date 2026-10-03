import OBR from '@owlbear-rodeo/sdk';
import {pageHost} from './page-route';
OBR.onReady(()=>{void(async()=>{
 const metadata=await OBR.room.getMetadata();
 const host=pageHost(location.pathname,metadata);
 if(host==='stable-legacy')await import('./stable-legacy-page');
 else if(host==='legacy')await import('./legacy-page');
 else{const {mountServerPage}=await import('./server-page');await mountServerPage(metadata);}
})().catch(error=>{
 const root=document.getElementById('table-app');if(root){const message=document.createElement('p');message.textContent='牌桌连接失败，请重试。'+String(error);const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>location.reload();root.replaceChildren(message,retry);}
});});
