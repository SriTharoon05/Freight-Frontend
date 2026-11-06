import test from 'node:test';
import assert from 'node:assert/strict';
import {forwardDemo} from '../lib/meridian-demo-proxy.mjs';

const id='00000000-0000-4000-8000-000000000001';
const token='Bearer demo_c_'+'a'.repeat(43);
function req(path='sessions',method='POST',headers={},body) {
  return new Request('https://freight.test/api/meridian-demo/'+path,{method,headers:{'Content-Type':'application/json',...headers},body});
}

test('the presentation proxy forwards only disposable controller commands without cookies or company keys',async()=>{
  let calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return Response.json({id});};
  let result=await forwardDemo(req('sessions','POST',{'Cookie':'freightos_token=private','X-Company-Key':'private'}),['sessions'],fetcher);
  assert.equal(result.status,200);
  assert.equal(calls[0].url,'https://freight-partners-api.onrender.com/v1/demo/sessions');
  assert.deepEqual(calls[0].options.headers,{'Content-Type':'application/json'});
  result=await forwardDemo(req('sessions/'+id+'/assign','POST',{Authorization:token},JSON.stringify({name:'Demo driver',phone:'+15555550123'})),['sessions',id,'assign'],fetcher);
  assert.equal(result.status,200);
  assert.equal(calls[1].options.headers.Authorization,token);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(result.headers.get('access-control-allow-origin'),null);
});

test('the proxy denies production paths, driver commands, arbitrary origins and non-demo credentials',async()=>{
  const never=()=>{throw new Error('No upstream request is allowed');};
  for (const parts of [['profile'],['admin','companies'],['sessions','..','profile'],['sessions',id,'locations'],['sessions',id,'driver']]) {
    assert.equal((await forwardDemo(req(),parts,never)).status,404);
  }
  for (const auth of ['Bearer production-jwt','Bearer demo_d_'+'a'.repeat(43),'']) {
    assert.equal((await forwardDemo(req('sessions/'+id,'GET',{Authorization:auth}),['sessions',id],never)).status,401);
  }
  assert.equal((await forwardDemo(req('sessions','POST',{Origin:'https://outside.test'}),['sessions'],never)).status,403);
  assert.equal((await forwardDemo(req('sessions?url=https://outside.test'),['sessions'],never)).status,404);
  assert.equal((await forwardDemo(req('sessions','POST',{},'x'.repeat(4097)),['sessions'],never)).status,413);
});

test('the proxy keeps upstream failures generic, forwards expiry, and handles deletion',async()=>{
  const parts=['sessions',id];
  const expiry=await forwardDemo(req('sessions/'+id,'GET',{Authorization:token}),parts,async()=>Response.json({detail:'Demo expired'},{status:401}));
  assert.equal(expiry.status,401);
  const ended=await forwardDemo(req('sessions/'+id,'DELETE',{Authorization:token}),parts,async()=>new Response(null,{status:204}));
  assert.equal(ended.status,204);
  const down=await forwardDemo(req(),['sessions'],async()=>{throw new Error('private infrastructure error');});
  assert.equal(down.status,503);
  assert.doesNotMatch(await down.text(),/private infrastructure/);
});

test('the bridge accepts the browser-facing host when Next uses an internal route URL',async()=>{
  const request=new Request('http://localhost:4341/api/meridian-demo/sessions',{method:'POST',headers:{'Host':'127.0.0.1:4341','Origin':'http://127.0.0.1:4341','Content-Type':'application/json'}});
  const response=await forwardDemo(request,['sessions'],async()=>Response.json({id}));
  assert.equal(response.status,200);
});

test('controller proof reads are authenticated, JPEG only and bounded',async()=>{
  const parts=['sessions',id,'proofs',id,'content'];
  const request=auth=>req(parts.join('/'),'GET',{Authorization:auth});
  let response=await forwardDemo(request(token),parts,async()=>new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}}));
  assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.equal((await response.arrayBuffer()).byteLength,3);
  response=await forwardDemo(request(''),parts,()=>{throw new Error('must not fetch');});
  assert.equal(response.status,401);
  response=await forwardDemo(request(token),parts,async()=>new Response(new Uint8Array(49153),{headers:{'Content-Type':'image/jpeg'}}));
  assert.equal(response.status,503);
  response=await forwardDemo(request(token),parts,async()=>new Response('<script/>',{headers:{'Content-Type':'text/html'}}));
  assert.equal(response.status,503);
});
