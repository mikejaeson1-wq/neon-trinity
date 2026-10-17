import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyRelease} from '../scripts/verify-release.mjs';
const {StudioUpdater}=createRequire(import.meta.url)('../desktop/updates.cjs');
class Updater extends EventEmitter{
  checks=0;downloads=0;installs=0;
  async checkForUpdates(){this.checks++;this.emit('checking-for-update');this.emit('update-available',{version:'0.5.0',releaseNotes:'<b>Neues Studio</b>'});}
  async downloadUpdate(){this.downloads++;this.emit('download-progress',{percent:35});await Promise.resolve();this.emit('update-downloaded',{version:'0.5.0'});}
  quitAndInstall(silent,restart){assert.equal(silent,false);assert.equal(restart,true);this.installs++;}
}
test('Ein Update lädt erst auf Klick, wird nur einmal geladen und erst nach vollständigem Download installiert',async()=>{
  const updater=new Updater(),states=[];let scheduled,before=false;
  const service=new StudioUpdater({updater,version:'0.4.0',onStatus:s=>states.push(s),schedule:fn=>scheduled=fn,beforeInstall:()=>before=true});
  assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);assert.equal(updater.allowDowngrade,false);
  assert.throws(()=>service.install(),/vollständig/);
  await Promise.all([service.check(),service.check()]);assert.equal(updater.checks,1);assert.equal(updater.downloads,0);assert.equal(service.status().phase,'available');
  assert.equal(service.status().notes,'Neues Studio');
  await Promise.all([service.download(),service.download()]);assert.equal(updater.downloads,1);assert.equal(service.status().phase,'ready');assert.ok(states.some(s=>s.phase==='downloading'&&s.percent===35));
  await service.check();assert.equal(updater.checks,1);assert.equal(service.status().phase,'ready');
  service.install();assert.equal(updater.installs,0);assert.equal(service.status().phase,'installing');scheduled();assert.equal(before,true);assert.equal(updater.installs,1);
  service.stop();
});
test('Fehlgeschlagene Prüfung und beschädigte Downloads lassen sich erneut versuchen und werden nicht installiert',async()=>{
  const updater=new Updater(),service=new StudioUpdater({updater,version:'0.4.0'});
  const normal=updater.checkForUpdates.bind(updater);updater.checkForUpdates=()=>{throw new Error('network unavailable');};
  await service.check();assert.equal(service.status().phase,'error');
  updater.checkForUpdates=normal;await service.check();assert.equal(service.status().phase,'available');
  const download=updater.downloadUpdate.bind(updater);updater.downloadUpdate=()=>{const error=new Error('sha512 checksum mismatch');updater.emit('error',error);throw error;};
  await service.download();assert.equal(service.status().phase,'error');assert.throws(()=>service.install(),/vollständig/);assert.equal(updater.installs,0);
  updater.downloadUpdate=download;await service.check();await service.download();assert.equal(service.status().phase,'ready');service.stop();
});
test('Entwicklungs- und Browser-Ausgaben starten keinen Windows-Updater',async()=>{
  const updater=new Updater(),service=new StudioUpdater({updater,version:'0.4.0',supported:false});service.start();
  assert.equal((await service.check()).phase,'unsupported');assert.equal(updater.checks,0);await assert.rejects(service.download(),/Setup/);assert.throws(()=>service.install(),/vollständig/);service.stop();
});
test('Eine Release-Datei mit falscher Version oder Prüfsumme wird vor der Veröffentlichung abgewiesen',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'neon-release-'));
  try{
    const installer=Buffer.from('MZ-test-installer'),sha=createHash('sha512').update(installer).digest('base64');
    await writeFile(path.join(directory,'Neon-Trinity-Studio-Setup.exe'),installer);
    await writeFile(path.join(directory,'Neon-Trinity-Studio-Setup.exe.blockmap'),'blockmap');
    await writeFile(path.join(directory,'latest.yml'),`version: 0.4.0\nfiles:\n  - url: Neon-Trinity-Studio-Setup.exe\n    sha512: ${sha}\n    size: ${installer.length}\n`);
    assert.equal((await verifyRelease(directory,'0.4.0')).bytes,installer.length);
    await assert.rejects(verifyRelease(directory,'0.5.0'),/Version/);
    await writeFile(path.join(directory,'Neon-Trinity-Studio-Setup.exe'),'MZ-corrupted');
    await assert.rejects(verifyRelease(directory,'0.4.0'),/Prüfsumme/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
