import {escapeHTML as h} from './core.mjs';
import {STUDIO_VERSION,INSTALL_PAGE,SETUP_URL} from './version.mjs';
export function updatePanel(status={},desktop=false){
  const s={phase:desktop?'idle':'browser',currentVersion:STUDIO_VERSION,...status};
  const busy=['checking','downloading','installing'].includes(s.phase);
  return `<h2>Studio & Updates.</h2><p>Installierte Version: <strong>${h(s.currentVersion)}</strong>${s.version?` · Neue Version: <strong>${h(s.version)}</strong>`:''}</p><p role="status" aria-live="polite">${h(s.message||(desktop?'Updates werden beim Start automatisch gesucht.':'Installiere die Windows-App, um Updates direkt im Studio zu erhalten.'))}</p>${s.phase==='downloading'?`<progress class="update-progress" value="${Math.min(100,Math.max(0,Number(s.percent)||0))}" max="100" aria-label="Update herunterladen"></progress><p class="notice">${Math.floor(Number(s.percent)||0)} % heruntergeladen</p>`:''}${s.notes?`<details class="update-notes"><summary>Was ist neu?</summary><p>${h(s.notes)}</p></details>`:''}<div class="toolbar">${desktop&&s.phase!=='unsupported'?`<button class="button ghost" data-action="update-check" ${busy||s.phase==='ready'?'disabled':''}>Nach Updates suchen</button>${s.phase==='available'?'<button class="button primary" data-action="update-download">↓ Update herunterladen</button>':''}${s.phase==='ready'?'<button class="button primary" data-action="update-install">Neustarten & installieren</button>':''}`:`<a class="button primary" href="${SETUP_URL}" target="_blank" rel="noopener">↓ Windows installieren</a>`}<a class="button ghost" href="${INSTALL_PAGE}" target="_blank" rel="noopener">Installation für Nix & Jax ↗</a></div><p class="notice">Downloads starten per Klick. Installiert wird erst mit „Neustarten & installieren“. Deine Anmeldung, Musik und Einstellungen bleiben erhalten.</p>`;
}
export function updateNotice(status={}){
  if(!['available','downloading','ready','installing'].includes(status.phase))return '';
  const text={available:`Studio ${status.version} ist verfügbar.`,downloading:`Studio-Update wird heruntergeladen · ${Math.floor(Number(status.percent)||0)} %`,ready:'Dein Studio-Update ist bereit zur Installation.',installing:'Studio-Update wird installiert …'}[status.phase];
  return `<span>${h(text)}</span><a class="button ghost compact" href="#settings">Zum Update ↗</a>`;
}
