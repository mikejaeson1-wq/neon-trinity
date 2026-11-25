import {escapeHTML as h,time} from './core.mjs';

export const filterEventMusic=(tracks,query='')=>{
 const term=query.trim().toLocaleLowerCase('de');
 return tracks.filter(t=>[t.title,t.artist,t.genre].join(' ').toLocaleLowerCase('de').includes(term));
};

export function eventMusicResults({tracks=[],query='',currentId=null}={}){
 const visible=filterEventMusic(tracks,query);
 const summary=`<div class="toolbar"><span class="badge" role="status" aria-live="polite">${visible.length} TITEL · ${time(visible.reduce((sum,t)=>sum+t.duration,0))}</span>${visible.length?'<button class="button ghost" data-action="play-event-music">Alle abspielen</button>':''}</div>`;
 if(!visible.length)return summary+`<section class="empty-state"><h2>${query.trim()?'Keine passenden Titel.':'Die Musik für euer nächstes Event.'}</h2><p>${query.trim()?'Versuche einen anderen Suchbegriff.':'Lade MP3s hoch und erstelle anschließend die Musikbox-Links für eure Location.'}</p></section>`;
 return summary+`<div class="table-wrap"><table class="track-table event-music-table"><thead><tr><th>#</th><th>Titel / Interpret</th><th>Dauer</th><th>Aktionen</th></tr></thead><tbody>${visible.map((t,i)=>`<tr data-musicbox-kind="event-track" data-musicbox-id="${h(t.id)}" tabindex="0" class="${t.id===currentId?'selected-track':''}"><td class="number">${String(i+1).padStart(2,'0')}</td><td><div class="song-cell"><button class="song-art" data-action="play-track" data-context="event-music" data-id="${h(t.id)}" aria-label="${h(t.title)} abspielen">${t.coverBlobId?`<img data-blob="${h(t.coverBlobId)}" src="assets/logo.svg" alt="">`:'▶'}</button><div><strong>${h(t.title)}</strong><small>${h(t.artist||'Unbekannter Interpret')}</small></div></div></td><td class="duration">${time(t.duration)}</td><td><div class="row-actions"><button class="button ghost compact" data-action="event-music-link" data-id="${h(t.id)}">Musikbox-Link</button><button class="icon-button" data-action="edit-track" data-id="${h(t.id)}" aria-label="${h(t.title)} bearbeiten">⋯</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

export function eventMusicView({tracks=[],connected=false,query='',currentId=null}={}){
 const heading='<div class="page-heading"><div><h1>Event Musik.</h1><p>Deine Musik für Beachclub, Feiern und andere RP-Events.</p></div>'+(connected?'<button class="button primary" data-action="import-event-music">MP3s hochladen</button>':'')+'</div>';
 if(!connected)return heading+'<section class="panel settings-section"><h2>Mit deinem Studio-Konto öffnen.</h2><p>Hier verwaltet ihr eure gemeinsame Event-Musik und erstellt direkte MP3-Links für die Musikbox.</p><a class="button primary" href="#team">Mit Discord anmelden</a></section>';
 return heading+`<div class="upload-zone" role="button" tabindex="0" data-action="import-event-music"><div class="upload-icon">＋</div><div><strong>Event-Musik hinzufügen</strong><p>MP3-Dateien hierher ziehen oder auswählen · bis 48 MiB pro Datei</p></div><button class="button ghost" data-action="import-event-music">Dateien auswählen</button></div><p class="notice">Gemeinsam im Studio verfügbar. Wähle bei einem Titel „Musikbox-Link“ oder öffne das Rechtsklick-Menü, um seine MP3-Adresse zu kopieren.</p><label class="field"><span>Event Musik durchsuchen</span><input id="event-music-search" type="search" value="${h(query)}" placeholder="Titel, Interpret oder Genre"></label><section id="event-music-results">${eventMusicResults({tracks,query,currentId})}</section>`;
}
