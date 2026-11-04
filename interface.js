(()=>{
 const bar=document.createElement('nav');bar.className='command-bar';bar.setAttribute('aria-label','Навигация игры');
 bar.innerHTML='<span class="brand">HIVEBREAK <small>GENESIS / 1.2</small></span><button data-action="back">← Назад</button><button data-action="pause">Пауза</button><button id="evolve">Эволюция</button>';
 document.body.prepend(bar);
 const panel=document.createElement('dialog');panel.className='evolution';panel.innerHTML='<header><div><small>ГЕНЕТИЧЕСКАЯ АДАПТАЦИЯ</small><h2>Эволюция образца</h2></div><button id="close-evolution" aria-label="Закрыть">✕</button></header><div id="specimens"></div><p id="xp-summary"></p><div id="genes"></div><p class="muted">Опыт за победы сохраняется отдельно для каждого класса. Максимум — 12 очков. Распределение доступно между боями и на паузе.</p>';
 document.body.append(panel);panel.addEventListener('keydown',e=>e.stopPropagation());bar.addEventListener('keydown',e=>e.stopPropagation());let specimen=0;
 function render(){const api=window.HIVEBREAK,p=api.evolution[specimen],rules=window.HiveProgression;
 document.getElementById('specimens').innerHTML=['ДРОН','ВОИН','РАННЕР','СТРАЖ'].map((n,i)=>`<button data-specimen="${i}" aria-pressed="${i===specimen}">${n}</button>`).join('');
 const lv=rules.level(p),next=150*(lv+1)*(lv+2)/2;document.getElementById('xp-summary').textContent=`Уровень ${lv}/12 · Опыт ${p.xp}${lv<12?' / '+next:''} · Свободных очков: ${rules.points(p)}`;
 document.getElementById('genes').innerHTML=rules.keys.map((key,i)=>`<button class="gene" data-gene="${key}" ${!rules.points(p)||p.ranks[key]>=3?'disabled':''}><strong>${rules.labels[i]} <span>${p.ranks[key]} / 3</span></strong><small>${rules.descriptions[i]}</small></button>`).join('');}
 bar.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a){window.HIVEBREAK.ui(a.dataset.action);document.getElementById('game').focus();}if(e.target.id==='evolve'){if(window.HIVEBREAK.screen==='playing')window.HIVEBREAK.ui('pause');specimen=window.HIVEBREAK.uiState.selected;render();panel.showModal();}});
 panel.addEventListener('click',e=>{if(e.target.id==='close-evolution'){panel.close();document.getElementById('game').focus();return;}const s=e.target.closest('[data-specimen]'),g=e.target.closest('[data-gene]');if(s){specimen=Number(s.dataset.specimen);render();}if(g){window.HIVEBREAK.upgrade(specimen,g.dataset.gene);render();}});
 panel.addEventListener('cancel',()=>document.getElementById('game').focus());
 function refresh(){if(!window.HIVEBREAK)return;const s=window.HIVEBREAK.screen;document.getElementById('evolve').textContent='Эволюция · '+window.HIVEBREAK.uiState.points;bar.querySelector('[data-action="pause"]').hidden=s!=='playing';bar.querySelector('[data-action="back"]').hidden=s==='menu';document.getElementById('evolve').hidden=!['menu','select','paused','stageclear','playing'].includes(s);}
 setInterval(refresh,250);refresh();
})();
