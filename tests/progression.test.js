const assert=require('node:assert/strict'),r=require('../progression.js');
const p=r.clean({xp:450,ranks:{damage:999,speed:-10}});assert.equal(p.ranks.damage,3);assert.equal(p.ranks.speed,0);
const a=r.clean();assert(!r.buy(a,'damage'));a.xp=150;assert.equal(r.level(a),1);assert(r.buy(a,'damage'));assert(!r.buy(a,'speed'));assert(!r.buy(a,'__proto__'));
a.xp=1000000;assert.equal(r.level(a),12);assert(r.buy(a,'damage'));assert(r.buy(a,'damage'));assert(!r.buy(a,'damage'));
for(const k of r.keys)while(r.buy(a,k)){}assert.equal(r.points(a),0);assert.equal(Object.values(a.ranks).reduce((x,y)=>x+y),12);
const b=r.clean(JSON.parse(JSON.stringify(a)));assert.deepEqual(b,a);assert.equal(r.clean({xp:NaN}).xp,0);
console.log('PASS progression: XP thresholds, bounded ranks, 12-point budget, purchase validation and save roundtrip');
