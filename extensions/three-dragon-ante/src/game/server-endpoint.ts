/** Shared HTTP endpoint: no Owlbear SDK or identity dependencies. */
import {withRequestTimeout} from '../../../../src/request-timeout';
export const serverBase=(import.meta.env?.VITE_TDA_API||'/three-dragon-api/v1').replace(/\/+$/,'');
export async function serverPost(path:string,data:unknown,token?:string){
 return withRequestTimeout(12000,undefined,async signal=>{
 const response=await fetch(serverBase+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),signal});
 const value=await response.json();if(!response.ok)throw Error(value.error||'requestFailed');return value;
 });
}
