/* Bounded, per-specimen progression. Pure rules are also used by Node tests. */
(function(root){
 const keys=['damage','speed','health','haste','mobility','passive'];
 const labels=['Сила когтей','Скорость','Живучесть','Темп атак','Мобильность','Адаптация'];
 const descriptions=['+4% урона за ранг','+3% скорости за ранг','+6% здоровья за ранг','Восстановление атак короче на 1 тик','+8% регенерации, −4% откат рывка','Дрон: лечение • Воин: броня • Раннер: энергия • Страж: защита'];
 function clean(raw={}){return {xp:Math.max(0,Math.min(1000000,Math.floor(Number(raw.xp)||0))),ranks:Object.fromEntries(keys.map(k=>[k,Math.max(0,Math.min(3,Math.floor(Number(raw.ranks?.[k])||0)))]))}}
 function level(p){return Math.min(12,Math.floor((Math.sqrt(1+8*p.xp/150)-1)/2))}
 function points(p){return Math.max(0,level(p)-keys.reduce((n,k)=>n+p.ranks[k],0))}
 function buy(p,k){if(!keys.includes(k)||p.ranks[k]>=3||!points(p))return false;p.ranks[k]++;return true}
 const api={keys,labels,descriptions,clean,level,points,buy};if(typeof module!=='undefined')module.exports=api;else root.HiveProgression=api;
})(typeof window!=='undefined'?window:globalThis);
