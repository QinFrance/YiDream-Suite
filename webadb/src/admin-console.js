import * as cloud from './cloud-admin.js';
import logoUrl from '../assets/yidream-logo.png';
const $=(s,r=document)=>r.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=$('#app');
const suiteHomeHref=()=>location.pathname.endsWith('/admin/')?'../index.html':'./index.html';
const withTimeout=(promise,label='connexion',ms=15000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Le chargement de ${label} prend trop de temps. Vérifiez votre connexion puis réessayez.`)),ms))]);
document.addEventListener('click',e=>{if(e.target.closest('.account-box'))return;const m=$('#accountMenu'),b=$('#accountToggle');if(m)m.classList.add('hidden');if(b)b.setAttribute('aria-expanded','false')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=$('#accountMenu'),b=$('#accountToggle');if(m)m.classList.add('hidden');if(b)b.setAttribute('aria-expanded','false')}}); let state={session:null,data:null,page:'dashboard',deviceQuery:'',clientQuery:'',tab:'Tous',platformLabel:'',platformMenus:{}}; const names={dashboard:'Vue d’ensemble',devices:'Appareils',clients:'Clients',activity:'Journal'};
function message(msg){const n=$('#authError')||$('#message');if(n)n.textContent=msg}
function notify(text){const n=document.createElement('div');n.textContent=text;n.style='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#102448;color:#fff;padding:11px 16px;border-radius:999px;z-index:20';document.body.append(n);setTimeout(()=>n.remove(),2200)}
async function refresh(){state.data=await withTimeout(cloud.loadData(),'des appareils et clients');render()}
function authScreen(mode='login',error=''){
 const register=mode==='register';
 app.innerHTML=`<div class="auth-wrap"><section class="auth"><a href="${suiteHomeHref()}" class="brand" style="padding:0 0 20px"><img src="${logoUrl}" alt=""> YiDream <span style="color:#73819a;font-weight:500">Suite</span></a><h1>${register?'Créer votre compte revendeur':'Connexion revendeur'}</h1><p>${register?'Créez votre espace sécurisé pour gérer votre parc.':'Retrouvez vos clients et appareils dans votre espace.'}</p>
 <div id="authError" class="msg">${esc(error)}</div>
 ${register?'<div class="field"><label>Nom de la boutique ou entreprise</label><input id="shop" autocomplete="organization"></div>':''}
 <div class="field"><label>Adresse e-mail</label><input id="email" type="email" autocomplete="email"></div><div class="field"><label>Mot de passe</label><input id="password" type="password" autocomplete="${register?'new-password':'current-password'}"></div>
 ${register?'<div class="field"><label>Confirmer le mot de passe</label><input id="confirm" type="password" autocomplete="new-password"></div>':''}
 <button id="submit" class="button primary">${register?'Créer mon compte':'Se connecter'}</button><div class="or">ou</div><button id="google" class="button google-button"><span class="google-mark" aria-hidden="true">G</span>Continuer avec Google</button>
 <p style="font-size:11px;margin:18px 0 0;text-align:center">${register?'Déjà inscrit ?':'Nouveau revendeur ?'} <button class="link" id="swap">${register?'Se connecter':'Créer un compte'}</button></p></section></div>`;
 $('#swap').onclick=()=>authScreen(register?'login':'register');
 $('#google').onclick=async()=>{const b=$('#google');b.disabled=true;b.textContent='Redirection vers Google…';try{await cloud.signInGoogle()}catch(e){authScreen(mode,errorText(e))}};
 $('#submit').onclick=async()=>{
  const email=$('#email').value.trim(),password=$('#password').value;
  if(register&&password!==$('#confirm').value){message('Les mots de passe ne correspondent pas.');return}
  const b=$('#submit');b.disabled=true;b.textContent='Patientez…';
  try{
   if(register){const d=await cloud.signUp({shopName:$('#shop').value,email,password});if(!d.session){authScreen('login','Vérifiez votre e-mail pour confirmer votre compte, puis connectez-vous.');return}}
   else await cloud.signIn({email,password});
   await start();
  }catch(e){b.disabled=false;b.textContent=register?'Créer mon compte':'Se connecter';message(errorText(e))}
 };
}
function errorText(e){const m=typeof e==='string'?e:(e?.message||'');if(/Invalid login credentials/i.test(m))return 'Adresse e-mail ou mot de passe incorrect.';if(/Email not confirmed/i.test(m))return 'Confirmez votre adresse e-mail avant de vous connecter.';if(/provider.*not enabled|unsupported provider/i.test(m))return 'La connexion Google doit être activée dans Supabase Auth → Providers → Google avec des identifiants OAuth Google.';if(/redirect_uri_mismatch|redirect URI mismatch/i.test(m))return 'Google refuse l’adresse de retour. Vérifiez l’URI de rappel configurée dans Google Cloud.';if(/invalid_client|unauthorized_client|client authentication failed/i.test(m))return 'Google refuse l’identifiant OAuth. Vérifiez le Client ID et le Client Secret dans Supabase.';if(/redirect.*(url|uri)|not allowed/i.test(m))return 'Cette adresse de retour n’est pas autorisée dans Supabase Auth → URL Configuration.';return m||'Une erreur est survenue.'}
function oauthErrorFromUrl(){const p=new URLSearchParams(location.search);const m=p.get('error_description')||p.get('error_code')||p.get('error');return m?errorText(m):''}
async function onboarding(error=''){
 app.innerHTML=`<div class="auth-wrap"><section class="auth"><a href="${suiteHomeHref()}" class="brand" style="padding:0 0 20px"><img src="${logoUrl}" alt=""> YiDream <span style="color:#73819a;font-weight:500">Suite</span></a><h1>Votre espace revendeur</h1><p>Indiquez le nom de votre boutique pour terminer la création de l’espace.</p><div id="authError" class="msg">${esc(error)}</div><div class="field"><label>Nom de la boutique ou entreprise</label><input id="shop" autocomplete="organization"></div><button class="button primary" id="save">Continuer</button><button class="link" id="logout" style="display:block;margin:15px auto 0">Se déconnecter</button></section></div>`;
 $('#logout').onclick=()=>cloud.signOut();$('#save').onclick=async()=>{try{const p=await cloud.ensureProfile($('#shop').value);if(!p){$('#authError').textContent='Saisissez le nom de votre entreprise.';return}await refresh()}catch(e){$('#authError').textContent=errorText(e)}}
}
function shell(){
 const d=state.data;
 const initials=(d.profile.shop_name||'Y').trim().slice(0,2).toLocaleUpperCase('fr-FR');
 const platforms=[['Android','🤖',true],['iOS','▯',false],['YiDream Auto','🚗',false],['macOS','▱',false],['Windows','▦',false]];
 const platformMarkup=platforms.map(([name,icon,available])=>{const open=!!state.platformMenus[name];return `<div class="platform-group"><button class="platform-toggle ${state.platformLabel===name?'active':''}" data-platform-toggle="${esc(name)}" aria-expanded="${open}"><span class="ico">${icon}</span><span>${esc(name)}</span><span class="chevron">${open?'⌄':'›'}</span></button><div class="platform-submenu ${open?'':'hidden'}" data-platform-panel="${esc(name)}">${available?`<button class="platform-action" data-platform-action="Android">Appareils Android</button><a class="platform-link" href="${suiteHomeHref()}">Ouvrir YiDream Suite</a><span class="platform-status available">Déjà dispo</span>`:`<span class="platform-status coming">Bientôt dispo</span>`}</div></div>`}).join('');
 app.innerHTML=`<div class="shell"><aside class="side"><div class="brand"><img src="${logoUrl}" alt="">YiDream <span class="suite-word">Suite</span></div><div class="workspace">Espace de gestion</div><nav class="nav"><button data-page="dashboard"><span class="ico">⌂</span>Vue d’ensemble</button><button data-page="devices"><span class="ico">▣</span>Appareils</button><button data-page="clients"><span class="ico">◎</span>Clients</button><button data-page="activity"><span class="ico">≋</span>Journal d’activité</button></nav><div class="platform-heading">Plateformes</div><div class="platform-list">${platformMarkup}</div><div class="side-bottom"><div class="account-box"><button id="accountToggle" class="account-trigger" aria-expanded="false" aria-controls="accountMenu"><span class="avatar">${esc(initials)}</span><span class="account-copy"><b>${esc(d.profile.shop_name)}</b><small>${esc(state.session.user.email)}</small></span><span class="account-caret">⌃</span></button><div id="accountMenu" class="account-menu hidden"><div class="account-menu-head"><small>COMPTE REVENDEUR</small><b>${esc(d.profile.shop_name)}</b><span>${esc(state.session.user.email)}</span></div><div class="account-menu-rule"></div><button id="logout" class="logout-button">Se déconnecter</button></div></div></div></aside><main class="main"><header class="topbar"><span class="crumb">YiDream Suite / <b id="crumb">${state.platformLabel||names[state.page]}</b></span><div class="top-actions"><span class="role">ESPACE ADMINISTRATEUR</span><span class="hebrew-decor" dir="rtl" lang="he" aria-hidden="true">בס״ד</span></div></header><section class="content" id="content"></section></main></div>`;
 document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===state.page&&!state.platformLabel);b.onclick=()=>{state.page=b.dataset.page;state.platformLabel='';state.tab='Tous';render()}});
 $('#accountToggle').onclick=()=>{const b=$('#accountToggle'),m=$('#accountMenu'),open=m.classList.contains('hidden');m.classList.toggle('hidden',!open);b.setAttribute('aria-expanded',String(open))};
 $('#logout').onclick=async()=>{await cloud.signOut();state.session=null;state.data=null;authScreen()};
 document.querySelectorAll('[data-platform-toggle]').forEach(b=>b.onclick=()=>{const name=b.dataset.platformToggle;state.platformMenus[name]=!state.platformMenus[name];render()});
 document.querySelectorAll('[data-platform-action]').forEach(b=>b.onclick=()=>{state.page='devices';state.tab='Android';state.platformLabel='Android';state.deviceQuery='';render()});
}

function head(title,sub,action=''){return `<div class="heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function render(){
 if(!state.data)return;
 shell();const c=$('#content'),d=state.data;
 if(state.page==='dashboard'){
  const platforms=new Set(d.devices.map(x=>x.platform)).size;
  c.innerHTML=head('Vue d’ensemble',`Le suivi de votre parc et de vos clients, au même endroit.`, '<button class="button primary" id="quickAdd">＋ Inscrire un appareil</button>')+`<div class="stats"><div class="stat"><label>Appareils inscrits</label><strong>${d.devices.length}</strong><small>Fiches de votre parc</small></div><div class="stat"><label>Clients</label><strong>${d.clients.length}</strong><small>Comptes suivis</small></div><div class="stat"><label>Plateformes utilisées</label><strong>${platforms}</strong><small>Parmi les appareils inscrits</small></div><div class="stat"><label>Activité enregistrée</label><strong>${d.logs.length}</strong><small>Entrées chargées dans le journal</small></div></div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Appareils récents</h2><button class="link" data-goto="devices">Tout voir →</button></div>${d.devices.length?d.devices.slice(0,5).map(deviceRow).join(''):'<div class="empty">Aucun appareil inscrit pour le moment.<br>Ajoutez les appareils préparés avec YiDream.</div>'}</section><section class="panel"><div class="panel-head"><h2>Activité récente</h2><button class="link" data-goto="activity">Ouvrir le journal →</button></div>${d.logs.length?d.logs.slice(0,6).map(l=>`<div class="activity-row"><b>${esc(l.action)}</b><small>${new Date(l.created_at).toLocaleString('fr-FR')}</small></div>`).join(''):'<div class="empty">Aucune activité enregistrée.</div>'}</section></div><div class="notice">Les appareils affichés sont ceux enregistrés dans ce compte. Le statut en direct et les commandes à distance ne sont pas encore connectés. La configuration Android en USB reste accessible dans la Suite.</div>`;
  c.querySelector('[data-goto="devices"]').onclick=()=>{state.page='devices';state.tab='Tous';state.platformLabel='';render()};
  c.querySelector('[data-goto="activity"]').onclick=()=>{state.page='activity';render()};
  $('#quickAdd').onclick=()=>{state.page='devices';state.tab='Tous';state.platformLabel='';render();deviceForm(state.data)};
 }else if(state.page==='devices')renderDevices(c,d);
 else if(state.page==='clients')renderClients(c,d);
 else renderActivity(c,d);
}
function deviceRow(x){
 const cl=state.data.clients.find(c=>c.id===x.client_id);
 const icon={Android:'🤖',iOS:'▯',macOS:'▱',Windows:'▦'}[x.platform]||'▣';
 return `<div class="device-row"><div class="device-name"><span class="device-icon">${icon}</span><span><b>${esc(x.name)}</b><small>${esc(x.platform)} · ${cl?esc(cl.name):'Sans client'}</small></span></div><span class="cell">${cl?esc(cl.name):'Sans client'}</span><span class="badge">${esc(x.platform)}</span><span class="cell">${new Date(x.created_at).toLocaleDateString('fr-FR')}</span></div>`;
}
function renderDevices(c,d){
 let rows=d.devices.filter(x=>(state.tab==='Tous'||x.platform===state.tab)&&(!state.deviceQuery||`${x.name} ${x.platform}`.toLowerCase().includes(state.deviceQuery)));
 c.innerHTML=head(state.platformLabel||'Appareils','Appareils inscrits dans votre espace revendeur.', '<button class="button primary" id="add">＋ Ajouter un appareil</button>')+`<div class="panel"><div class="tabs">${['Tous','Android','iOS','macOS','Windows','Other'].map(x=>`<button data-tab="${x}" class="${state.tab===x?'active':''}">${x} ${x==='Tous'?d.devices.length:d.devices.filter(z=>z.platform===x).length}</button>`).join('')}</div><div class="actions" style="margin-bottom:14px"><input class="search" id="search" placeholder="Rechercher un appareil…" value="${esc(state.deviceQuery)}"></div><div id="form"></div><div class="table-wrap">${rows.length?`<table class="table"><thead><tr><th>Appareil</th><th>Plateforme</th><th>Client</th><th>Ajouté</th><th></th></tr></thead><tbody>${rows.map(x=>{const cl=d.clients.find(y=>y.id===x.client_id);return `<tr><td>${esc(x.name)}</td><td>${esc(x.platform)}</td><td>${cl?esc(cl.name):'—'}</td><td>${new Date(x.created_at).toLocaleDateString('fr-FR')}</td><td><button class="link" data-remove="${x.id}">Retirer</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty">Aucun appareil correspondant.</div>'}</div><div class="notice">Une fiche enregistrée n’indique pas une connexion active. Pour appliquer un profil à Android, utilisez l’outil Android avec le téléphone raccordé en USB.</div></div>`;
 $('#search').oninput=e=>{state.deviceQuery=e.target.value;renderDevices($('#content'),state.data)};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.platformLabel=state.tab==='Tous'?'':state.tab;render()});
 $('#add').onclick=()=>deviceForm(d);
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(confirm('Retirer cette fiche ?'))try{await cloud.removeDevice(b.dataset.remove);await refresh()}catch(e){notify(errorText(e))}});
}
function deviceForm(d){const el=$('#form');el.innerHTML=`<div class="panel"><div class="form"><div class="field"><label>Nom de l’appareil</label><input id="deviceName" placeholder="Ex. Galaxy A15"></div><div class="field"><label>Plateforme</label><select id="platform"><option>Android</option><option>iOS</option><option>macOS</option><option>Windows</option><option>Other</option></select></div><div class="field"><label>Client (facultatif)</label><select id="client"><option value="">—</option>${d.clients.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Note</label><input id="note" placeholder="Note interne"></div></div><div class="actions" style="margin-top:14px"><button id="save" class="button primary">Enregistrer</button><button id="cancel" class="button">Annuler</button></div></div>`;
 $('#cancel').onclick=()=>el.innerHTML='';$('#save').onclick=async()=>{try{const name=$('#deviceName').value.trim();if(!name)throw Error('Saisissez un nom pour l’appareil.');await cloud.addDevice({name,platform:$('#platform').value,clientId:$('#client').value,note:$('#note').value});await refresh()}catch(e){notify(errorText(e))}}
}
function renderClients(c,d){
 const rows=d.clients.filter(x=>!state.clientQuery||`${x.name} ${x.group_name}`.toLowerCase().includes(state.clientQuery));
 c.innerHTML=head('Clients','Gérez les clients et associez-leur les appareils.', '<button class="button primary" id="add">＋ Nouveau client</button>')+`<section class="panel"><div class="actions" style="margin-bottom:14px"><input id="search" class="search" placeholder="Rechercher un client…" value="${esc(state.clientQuery)}"></div><div id="form"></div><div class="table-wrap">${rows.length?`<table class="table"><thead><tr><th>Client</th><th>Groupe</th><th>Appareils associés</th><th>Créé</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.group_name)||'—'}</td><td>${d.devices.filter(z=>z.client_id===x.id).length}</td><td>${new Date(x.created_at).toLocaleDateString('fr-FR')}</td><td><button class="link" data-remove="${x.id}">Retirer</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Aucun client pour le moment.</div>'}</div></section>`;
 $('#search').oninput=e=>{state.clientQuery=e.target.value;renderClients($('#content'),state.data)};
 $('#add').onclick=()=>{const el=$('#form');el.innerHTML=`<div class="panel"><div class="form"><div class="field"><label>Nom du client</label><input id="clientName"></div><div class="field"><label>Groupe (facultatif)</label><input id="groupName"></div></div><div class="actions" style="margin-top:14px"><button id="save" class="button primary">Enregistrer</button><button id="cancel" class="button">Annuler</button></div></div>`;$('#cancel').onclick=()=>el.innerHTML='';$('#save').onclick=async()=>{try{const name=$('#clientName').value.trim();if(!name)throw Error('Saisissez le nom du client.');await cloud.addClient({name,group:$('#groupName').value});await refresh()}catch(e){notify(errorText(e))}}};
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(confirm('Retirer ce client ?'))try{await cloud.removeClient(b.dataset.remove);await refresh()}catch(e){notify(errorText(e))}});
}
function renderActivity(c,d){c.innerHTML=head('Journal d’activité','Actions enregistrées dans votre espace.')+`<section class="panel table-wrap">${d.logs.length?`<table class="table"><thead><tr><th>Action</th><th>Date</th></tr></thead><tbody>${d.logs.map(x=>`<tr><td>${esc(x.action)}</td><td>${new Date(x.created_at).toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Aucune activité pour le moment.</div>'}</section>`}
async function start(){
 if(!cloud.configured){app.innerHTML='<div class="auth-wrap"><section class="auth"><h1>Connexion à configurer</h1><p>YiDream Suite attend la configuration Supabase. Le site ne crée pas de comptes locaux.</p><div class="notice">La connexion au compte utilise Supabase. Si Google est refusé, activez le fournisseur dans Authentication → Providers → Google et vérifiez les URL de retour autorisées.</div><a class="button" style="display:block;text-align:center;margin-top:14px" href="${suiteHomeHref()}">Retour</a></section></div>';return}
 try{
  state.session=await withTimeout(cloud.session(),'la session revendeur');
  if(!state.session){authScreen();return}
  let p=await withTimeout(cloud.ensureProfile(),'le profil revendeur');
  if(!p){onboarding();return}
  await refresh();
 }catch(e){app.innerHTML='<div class="auth-wrap"><section class="auth"><h1>Impossible de charger votre espace</h1><p>'+esc(errorText(e))+'</p><button class="button" onclick="location.reload()">Réessayer</button></section></div>'}
}
if(cloud.configured)withTimeout(cloud.session(),'la session revendeur').then(s=>{state.session=s;if(s)start();else authScreen('login',oauthErrorFromUrl())}).catch(e=>authScreen('login',errorText(e)));else start();
