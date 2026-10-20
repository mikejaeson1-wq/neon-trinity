import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parseHTML} from 'linkedom';import {CLOUD} from '../app/cloud-config.mjs';
test('Die Sicherheitsregel erlaubt die tatsächlichen Netzwerkziele des Statuszentrums und behält lokale Skripte bei',async()=>{
 const {document}=parseHTML(await readFile(new URL('../app/index.html',import.meta.url),'utf8')),policy=document.querySelector('[http-equiv="Content-Security-Policy"]').content,connect=policy.split(';').find(v=>v.trim().startsWith('connect-src')).split(/\s+/);
 for(const target of [CLOUD.publicBase,CLOUD.url,'https://api.github.com'])assert.ok(connect.includes(new URL(target).origin),'Statusziel blockiert: '+target);assert.match(policy,/script-src 'self';/);assert.ok(!policy.includes("'unsafe-eval'"));assert.ok(!policy.includes("'unsafe-inline'"));
});
