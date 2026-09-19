import assert from 'node:assert/strict';
const base='http://localhost:3000';const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.AUTH_USERNAME,password:process.env.AUTH_PASSWORD})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];const request=(p,o={})=>fetch(base+p,{...o,headers:{...o.headers,Cookie:cookie}});async function cmd(data){const r=await request('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200);return(await r.json()).id;}
const project=await cmd({action:'project',name:'Multi attachment check'});
try{const task=await cmd({action:'task',project_id:project,title:'Combined update'});const path='/api/tasks/'+task;
 const post=async(message,files)=>{const f=new FormData();f.set('message',message);for(const [name,content]of files)f.append('files',new Blob([content]),name);return request(path,{method:'POST',body:f});};
 assert.equal((await post('Two files together',[['first.txt','one'],['second.txt','two']])).status,200);
 let events=await(await request(path)).json();const update=events.find(e=>e.message==='Two files together');assert.equal(update.attachments.length,2);assert.equal(events.filter(e=>e.kind==='update').length,1);
 for(const a of update.attachments)assert.equal(await(await request('/api/attachments/'+a.id)).text(),a.name==='first.txt'?'one':'two');
 assert.equal((await post('Text only',[])).status,200);const count=(await(await request(path)).json()).length;
 assert.equal((await post(' ',[['no.txt','x']])).status,400);assert.equal((await post('Invalid file',[['empty.txt','']])).status,400);assert.equal((await post('Too many',Array.from({length:11},(_,i)=>[i+'.txt','x']))).status,400);assert.equal((await post('Too large',[['large.bin',new Uint8Array(10*1024*1024+1)]])).status,400);assert.equal((await(await request(path)).json()).length,count);
 console.log('PASS: grouped multi-file update, downloads, text-only update, required message, empty/count/size validation, no partial events.');
}finally{await cmd({action:'delete_project',id:project,confirmation:'Multi attachment check'});}
