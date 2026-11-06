const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('the public demo is reachable while FGL operational routes still require a session', () => {
  const source = readFileSync(path.join(__dirname, '../proxy.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {exports, URL, require: () => ({NextResponse:{next:()=>({allowed:true}), redirect:url=>({redirect:url.pathname})}})});
  const request = (pathname, token=null) => ({nextUrl:{pathname}, url:'https://fgl.example'+pathname, cookies:{get:()=>token?{value:token}:undefined}});
  for(const route of ['/login','/demo','/demo/index.html','/demo/assets/app.js','/demo/partner/index.html'])
    assert.equal(exports.proxy(request(route)).allowed, true);
  for(const route of ['/dashboard','/shipments','/milestones','/demography'])
    assert.equal(exports.proxy(request(route)).redirect, '/login');
  assert.equal(exports.proxy(request('/dashboard','real-session')).allowed,true);
});
