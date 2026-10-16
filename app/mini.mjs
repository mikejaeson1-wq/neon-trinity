const api=window.neonDesktop;
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
document.querySelector('#restore').onclick=()=>api.showStudio();document.querySelector('#close').onclick=()=>api.closeMini();
for(const button of document.querySelectorAll('[data-command]'))button.onclick=()=>api.playerCommand({command:button.dataset.command});
document.querySelector('#seek').onchange=e=>api.playerCommand({command:'seek',value:Number(e.target.value)/100});
api.onPlayerState(state=>{document.querySelector('#title').textContent=state.title||'Neon Trinity Studio';document.querySelector('#artist').textContent=state.artist||'Dex · Nix · Jax';document.querySelector('#toggle').textContent=state.paused?'▶':'Ⅱ';document.querySelector('#time').textContent=`${time(state.position)} / ${time(state.duration)}`;document.querySelector('#seek').value=state.duration?state.position/state.duration*100:0;});
