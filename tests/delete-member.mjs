import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.AUTH_USERNAME,password:process.env.AUTH_PASSWORD})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
const request=(path,opts={})=>fetch(base+path,{...opts,headers:{...opts.headers,Cookie:cookie}});
async function cmd(body,status=200){const r=await request('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return (await r.json()).id;}
let p,m,team,teamMember;const name='Member deletion verification';
try{
 p=await cmd({action:'project',name});m=await cmd({action:'member',name:'Independent test member',team_id:null});team=await cmd({action:'team',name:'Deletion test team'});teamMember=await cmd({action:'member',name:'Protected team member',team_id:team});
 await cmd({action:'delete_member',id:teamMember},409);
 const t=await cmd({action:'task',project_id:p,title:'Preserved task'});await cmd({action:'assign',id:t,member_id:m,team_id:null});await cmd({action:'update',id:t,message:'Keep history'});await cmd({action:'day',id:t,day:'2026-09-19',included:true});
 const form=new FormData();form.set('message','Update with attachment');form.set('files',new Blob(['Keep attachment']),'keep.txt');assert.equal((await request('/api/tasks/'+t,{method:'POST',body:form})).status,200);
 await cmd({action:'delete_member',id:m});await cmd({action:'delete_member',id:m},404);
 const data=await(await request('/api/workspace')).json();assert.equal(data.members.some(x=>x.id===m),false);assert.ok(data.members.some(x=>x.id===teamMember));const task=data.tasks.find(x=>x.id===t);assert.equal(task.member_id,null);assert.equal(task.assigned_at,null);assert.deepEqual(task.my_days,['2026-09-19']);
 const events=await(await request('/api/tasks/'+t)).json();assert.ok(events.some(e=>e.message==='Keep history'));assert.ok(events.some(e=>e.message.includes('Independent test member')&&e.message.includes('deleted')));const attachment=events.find(e=>e.attachments?.length);assert.equal(await(await request('/api/attachments/'+attachment.attachments[0].id)).text(),'Keep attachment');
 const empty=await cmd({action:'member',name:'Empty independent member',team_id:null});await cmd({action:'delete_member',id:empty});
 console.log('PASS: independent/empty member deletion, team-member protection, repeat deletion, retained task/history/attachment/My Day, cleared assignment.');
}finally{if(p)await cmd({action:'delete_project',id:p,confirmation:name});if(team)await cmd({action:'delete_team',id:team});if(teamMember)await cmd({action:'delete_member',id:teamMember});if(m){const r=await request('/api/workspace');const data=await r.json();if(data.members.some(x=>x.id===m))await cmd({action:'delete_member',id:m});}}
