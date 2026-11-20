const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const babel=require('@babel/core');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/web-domain.ts'),'utf8');
const output=babel.transformSync(stripTypeScriptTypes(source),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const exported={};
vm.runInNewContext(output,{exports:exported,require:()=>({terminal:status=>['completed','cancelled','rejected'].includes(status)})});
const {jobSummary,visibleJobs}=exported;
const base={brief_version:1,acknowledged_brief_version:1,briefing:{origin:'Chennai',destination:'Mumbai'},company_name:'Meridian Logistics'};
const tasks=[{...base,id:'1',status:'pending_accept',job_reference:'MRD-01',kind:'pickup'},{...base,id:'2',status:'in_progress',brief_version:2,driver:{name:'Arun',vehicle:'DEMO 42'}},{...base,id:'3',status:'completed',brief_version:2},{...base,id:'4',status:'cancelled',brief_version:3}];
test('job attention counts revised active work and excludes closed jobs',()=>{
 const summary=jobSummary(tasks);assert.equal(summary.attention,2);assert.equal(summary.active,1);assert.equal(summary.completed,1);
 assert.deepEqual(Array.from(visibleJobs(tasks,'attention',''),task=>task.id),['1','2']);
});
test('search combines the selected status with job, company, route and driver details',()=>{
 assert.deepEqual(Array.from(visibleJobs(tasks,'active','  demo 42 '),task=>task.id),['2']);
 assert.equal(visibleJobs(tasks,'completed','Arun').length,0);
 assert.equal(visibleJobs(tasks,'all','mumbai').length,4);
 assert.equal(visibleJobs(tasks,'all','MERIDIAN').length,4);
 assert.equal(visibleJobs(tasks,'all','mrd-01')[0].id,'1');
 assert.equal(visibleJobs(tasks,'all','missing job').length,0);
});
test('filtering keeps server task state and input ordering unchanged',()=>{
 const before=JSON.stringify(tasks);visibleJobs(tasks,'active','');jobSummary(tasks);assert.equal(JSON.stringify(tasks),before);
 assert.equal(visibleJobs([],'all','').length,0);
 assert.equal(jobSummary([]).attention,0);
});
