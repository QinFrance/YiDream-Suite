import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const db=createClient('https://jqrznghqwdjbizjehzrm.supabase.co','sb_publishable_YG9zgjQ5Y56WiBtKdJMQvA_-UBAFv9B');
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
let devices=[],currentUser=null;
const check=result=>{if(result.error)throw result.error;return result.data;};
function errorMessage(error){return error.code==='PGRST202'||error.code==='PGRST205'||error.code==='42P01'?'Le service MDM doit être activé : appliquez la migration 20261029000000_mdm_catalog_and_site_requests.sql dans Supabase, puis actualisez.':(error.message||'Connexion impossible. Réessayez.');}
async function task(button,operation){if(button)button.disabled=true;try{await operation();}catch(error){status(errorMessage(error));}finally{if(button)button.disabled=false;}}
function line(parent,title,subtitle){const row=document.createElement('div');row.className='row';const heading=document.createElement('strong');heading.textContent=title;const info=document.createElement('small');info.textContent=subtitle;row.append(heading,info);parent.append(row);return row;}
async function load(){
 const session=check(await db.auth.getSession()).session;
 $('login').hidden=!!session;$('workspace').hidden=true;
 if(!session){status('Connectez-vous avec votre compte administrateur YiDream.');return;}
 currentUser=session.user;
 const role=check(await db.from('platform_admins').select('role').eq('user_id',currentUser.id).maybeSingle());
 if(!role){status('Ce compte ne dispose pas d’un accès administrateur.');return;}
 devices=check(await db.from('devices').select('id,name,user_id').order('name'));
 const [requests,apps]=await Promise.all([db.from('yd_site_requests').select('*').order('created_at',{ascending:false}).limit(200),db.from('yd_catalog').select('*').order('name')]);
 const rows=check(requests),catalog=check(apps);
 $('devices').replaceChildren(...devices.map(d=>{const option=document.createElement('option');option.value=d.id;option.textContent=d.name;return option;}));
 $('pair').disabled=devices.length===0;
 $('requests').replaceChildren();
 if(!rows.length)$('requests').textContent='Aucune demande reçue.';
 for(const request of rows){
  const device=devices.find(d=>d.id===request.device_id);
  const row=line($('requests'),request.site_url,`${device?.name||'Appareil'} · ${new Date(request.created_at).toLocaleString('fr')} · ${{pending:'En attente',approved:'Acceptée',rejected:'Refusée'}[request.status]}`);
  const reason=document.createElement('p');reason.textContent=request.reason;row.append(reason);
  if(request.status==='pending'){
   const note=document.createElement('textarea');note.placeholder='Réponse à l’utilisateur (facultatif)';note.maxLength=2000;row.append(note);
   for(const [decision,label]of [['approved','Accepter'],['rejected','Refuser']]){
    const button=document.createElement('button');button.textContent=label;row.append(button);
    button.onclick=()=>task(button,async()=>{check(await db.rpc('yd_review_site',{request_id:request.id,decision,note:note.value}));await load();});
   }
  }else if(request.admin_note){const note=document.createElement('p');note.textContent=request.admin_note;row.append(note);}
 }
 $('catalog').replaceChildren();
 for(const app of catalog){
  const row=line($('catalog'),app.name,`${app.package_name} · ${app.enabled?'Visible':'Masquée'}`);
  const button=document.createElement('button');button.textContent=app.enabled?'Masquer':'Publier';row.append(button);
  button.onclick=()=>task(button,async()=>{check(await db.from('yd_catalog').update({enabled:!app.enabled}).eq('id',app.id));await load();});
 }
 $('workspace').hidden=false;status('Connecté : '+currentUser.email);
}
$('loginForm').onsubmit=e=>{e.preventDefault();task(e.submitter,async()=>{check(await db.auth.signInWithPassword({email:$('email').value,password:$('password').value}));$('password').value='';await load();});};
$('refresh').onclick=e=>task(e.target,load);
$('pair').onclick=e=>task(e.target,async()=>{const code=check(await db.rpc('yd_create_pairing',{target_device:$('devices').value}));$('pairCode').textContent=code;});
$('catalogForm').onsubmit=e=>{e.preventDefault();task(e.submitter,async()=>{
 const values=Object.fromEntries(new FormData(e.target));
 const url=new URL(values.apk_url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Utilisez un lien HTTPS sans identifiants.');
 check(await db.from('yd_catalog').upsert({...values,owner_id:currentUser.id,enabled:true},{onConflict:'owner_id,package_name'}));e.target.reset();await load();
});};
await task(null,load);
