import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordRequests, discordModal, discordMessage } from './lib/discord-requests.js';
const id='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
const owner={id:'owner',email:'owner@example.com',role:'user'};
const admin={id:'admin',email:'staff@example.com',role:'staff'};
const request={id,subdomain:'site',root_domain:'example.com',requester_id:owner.id,requester_email:owner.email,status:'pending',record_type:'A',record_value:'8.8.8.8',created_date:'2026-01-01'};
function setup(rows=[request],comments=[]) {
  const calls=[];
  const database={
    get:async(entity,key)=>rows.find(row=>row.id===key),
    filter:async(entity,filter)=> (entity==='RequestComment'?comments:rows).filter(row=>Object.entries(filter).every(([key,value])=>value?.$in?value.$in.includes(row[key]):row[key]===value)),
    searchRequests:async options=>{calls.push(['search',options]);return rows.slice(options.offset,options.offset+options.limit);},
  };
  const ui=createDiscordRequests({database,invoke:async(name,body,actor)=>{calls.push([name,body,actor]);}});
  return {ui,calls};
}
const buttons=message=>message.components.flatMap(row=>row.components);
const event=(action,type=3)=>({type,data:{custom_id:`rm:${action}:${id}`}});

test('user request detail has reply and navigation but no staff controls',async()=>{
 const {ui}=setup();const result=await ui.view(owner,id);
 assert.ok(buttons(result).some(button=>button.label==='Reply'));
 assert.ok(!buttons(result).some(button=>button.label==='Approve'));
 assert.deepEqual(result.allowed_mentions,{parse:[]});
});
test('staff gets review controls and an explicit approval confirmation',async()=>{
 const {ui,calls}=setup();const detail=await ui.view(admin,id);
 assert.ok(buttons(detail).some(button=>button.label==='Internal note'));
 const confirmation=await ui.component(event('approve'),admin);
 assert.ok(buttons(confirmation).some(button=>button.label==='Confirm DNS approval'));
 assert.equal(calls.length,0);
 await ui.component(event('confirm'),admin);
 assert.equal(calls[0][0],'approveRequest');
});
test('forged staff button and modal IDs do not bypass role checks',async()=>{
 const {ui,calls}=setup();
 await assert.rejects(ui.component(event('confirm'),owner),/staff/i);
 await assert.rejects(ui.component({...event('send-note',5),data:{custom_id:`rm:send-note:${id}`,components:[{custom_id:'message',value:'secret'}]}},owner),/staff/i);
 assert.equal(calls.length,0);
});
test('ownership uses the stored account ID even when email matches',async()=>{
 const {ui}=setup();await assert.rejects(ui.view({...owner,id:'attacker'},id),/access/);
});
test('closed requests cannot be approved through stale buttons',async()=>{
 const {ui,calls}=setup([{...request,status:'rejected'}]);
 await assert.rejects(ui.component(event('confirm'),admin),/already rejected/);assert.equal(calls.length,0);
});
test('legacy bundle displays every record and sibling replies; internal messages stay staff-only',async()=>{
 const rows=[request,{...request,id:second,record_type:'AAAA',record_value:'2606:4700::1111',status:'user_responded'}];
 const comments=[{request_id:second,request_type:'subdomain',author_email:owner.email,message:'Sibling reply'},{request_id:id,request_type:'subdomain',author_email:admin.email,message:'Secret note',is_internal:true}];
 const {ui}=setup(rows,comments);const user=JSON.stringify(await ui.view(owner,id));const staff=JSON.stringify(await ui.view(admin,id));
 assert.match(user,/AAAA/);assert.match(user,/Sibling reply/);assert.match(user,/user_responded/);assert.doesNotMatch(user,/Secret note/);assert.match(staff,/Secret note/);
});
test('conflicting legacy records disable approval',async()=>{
 const {ui}=setup([request,{...request,id:second,record_type:'CNAME',record_value:'target.example.com'}]);const detail=await ui.view(admin,id);
 assert.equal(buttons(detail).find(button=>button.label==='Approve').disabled,true);assert.match(detail.content,/CNAME/);
});
test('modal opens directly and supports current Label components',()=>{
 const modal=discordModal(event('question'));assert.equal(modal.type,9);assert.equal(modal.data.components[0].type,18);assert.equal(modal.data.components[0].component.max_length,2000);
 assert.equal(discordModal(event('confirm')),null);assert.equal(discordModal({type:3,data:{custom_id:'rm:reject:bad-id'}}),null);
});
test('modal submissions post questions, internal notes and owner replies using shared handlers',async()=>{
 for(const [action,actor,type,internal] of [['question',admin,'question',false],['note',admin,'comment',true],['reply',owner,'reply',false]]) {
  const {ui,calls}=setup();await ui.component({type:5,data:{custom_id:`rm:send-${action}:${id}`,components:[{type:18,component:{type:4,custom_id:'message',value:'Useful details'}}]}},actor);
  assert.equal(calls[0][0],'postComment');assert.equal(calls[0][1].message_type,type);assert.equal(calls[0][1].is_internal,internal);assert.equal(calls[0][1].notify_user,action==='question');
 }
});
test('reject requires a reason and preserves it',async()=>{
 const {ui,calls}=setup();await assert.rejects(ui.act(admin,id,'send-reject','   '),/message/);
 await ui.act(admin,id,'send-reject',' Invalid target ');assert.equal(calls[0][0],'rejectRequest');assert.equal(calls[0][1].rejection_reason,'Invalid target');
});
test('queue pages are bounded, have navigation, and enforce staff access',async()=>{
 const rows=Array.from({length:7},(_,i)=>({...request,id:`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`,records:[{record_type:'A',record_value:'8.8.8.8'}]}));
 const {ui,calls}=setup(rows);const result=await ui.list(admin,'pending');
 assert.equal(buttons(result).find(button=>button.label==='Next').disabled,false);assert.equal(buttons(result).find(button=>button.label==='Previous').disabled,true);
 assert.ok(result.components.length<=5);assert.ok(result.components.every(row=>row.components.length<=5));assert.equal(calls[0][1].limit,6);
 await assert.rejects(ui.list(owner,'pending'),/staff/);await assert.rejects(ui.list(owner,'mine',-1),/page/);
});
test('conversation pages expose older messages without exposing internal notes',async()=>{
 const comments=Array.from({length:5},(_,i)=>({request_id:id,request_type:'subdomain',author_email:owner.email,message:`message${i}`}));
 const {ui}=setup([request],comments);const result=await ui.component({type:3,data:{custom_id:`rm:history:${id}:3`}},owner);
 assert.match(JSON.stringify(result.embeds),/message0/);assert.doesNotMatch(JSON.stringify(result.embeds),/message4/);
});
test('long messages fit Discord limits and disable mentions',()=>{
 const result=discordMessage('@everyone'.repeat(1000));assert.equal(result.content.length,1950);assert.deepEqual(result.allowed_mentions.parse,[]);
});
