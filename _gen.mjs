import { Level } from "./src/modules/Level.js";
import { Player } from "./src/modules/Player.js";
import { CHARACTERS } from "./src/data/characters.js";
const T = 48;
function buildGround(spans, cols){const a=Array(cols).fill(" ");for(const[s,e]of spans)for(let c=s;c<=e;c++)a[c]="#";return a.join("");}
function pitCols(spans, cols){const sset=new Set();for(const[s,e]of spans)for(let c=s;c<=e;c++)sset.add(c);const p=new Set();for(let c=0;c<cols;c++)if(!sset.has(c))p.add(c);return p;}
function run(r,c0,str){const o=[];for(let i=0;i<str.length;i++)if(str[i]!==" ")o.push([r,c0+i,str[i]]);return o;}
function makeLevel(name,theme,cols,spans,places){
  const grid=Array.from({length:14},()=>Array(cols).fill(" "));
  for(let r=11;r<=13;r++)grid[r]=buildGround(spans,cols).split("");
  for(const[r,c,ch]of places)grid[r][c]=ch;
  return {name,theme,cols,spans,lines:grid.map(a=>a.join("").replace(/\s+$/,""))};
}

const L1=makeLevel("1. なみのりビーチ","ocean",62,[[0,9],[12,23],[26,39],[42,61]],[
  ...run(3,15,"========"),...run(2,16,"o o o"),...run(7,44,"B B B"),
  ...run(9,10,"o o   o o"),...run(9,24,"o o"),...run(8,30,"o o o"),
  [10,18,"M"],[10,1,"P"],[10,6,"E"],[10,17,"^"],[10,33,"E"],[10,50,"E"],[10,59,"G"],
]);
const L2=makeLevel("2. どうくつケーブ","cave",58,[[0,11],[14,23],[26,37],[40,57]],[
  ...run(3,16,"======="),...run(2,17,"o o o"),...run(7,2,"B B"),
  ...run(9,12,"o o"),...run(9,24,"o o"),...run(9,38,"o o"),...run(8,44,"o o o"),
  [10,30,"M"],[10,1,"P"],[10,7,"E"],[10,20,"^"],[10,32,"E"],[10,45,"^"],[10,53,"G"],
]);
const L3=makeLevel("3. すいちゅうダイブ","water",60,[[0,9],[12,22],[25,35],[38,48],[51,59]],[
  ...run(3,14,"========"),...run(2,15,"o o o"),...run(7,52,"B B B"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,36,"o o"),...run(9,49,"o o"),...run(8,28,"o o o"),
  [10,31,"M"],[10,1,"P"],[10,6,"E"],[10,18,"^"],[10,28,"E"],[10,42,"^"],[10,45,"E"],[10,57,"G"],
]);
const L4=makeLevel("4. どかんパイプ","pipe",64,[[0,9],[12,22],[25,38],[41,52],[55,63]],[
  ...run(3,15,"========"),...run(2,16,"o o o"),...run(3,44,"======"),...run(2,45,"o o o"),
  ...run(7,4,"B B"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,39,"o o"),...run(9,53,"o o"),...run(8,28,"o o o"),
  [10,26,"M"],[10,1,"P"],[10,17,"^"],[10,29,"E"],[10,33,"^"],[10,46,"E"],[10,58,"^"],[10,62,"G"],
]);
const L5=makeLevel("5. そらのフォートレス","sky",72,[[0,9],[12,22],[25,36],[39,49],[52,62],[65,71]],[
  ...run(3,14,"========"),...run(2,15,"o o o"),...run(3,52,"======"),...run(2,53,"o o o"),...run(7,26,"B B B"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,37,"o o"),...run(9,50,"o o"),...run(9,63,"o o"),
  [10,30,"M"],[10,1,"P"],[10,6,"E"],[10,17,"^"],[10,28,"E"],[10,42,"^"],[10,46,"E"],[10,57,"^"],[10,69,"G"],
]);
const levels=[L1,L2,L3,L4,L5];

let bad=0;
for(const lv of levels){
  const pits=pitCols(lv.spans,lv.cols);
  const grid=lv.lines.map(l=>l.padEnd(lv.cols," "));
  const spikeCols=new Set();
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if(grid[r][c]==="^")spikeCols.add(c);
  const hazard=new Set([...pits,...spikeCols]);
  const bl=[];
  for(const c of hazard)for(let r=6;r<=10;r++){const ch=grid[r][c];if("=B#".includes(ch))bl.push(`${ch}@(${c},${r})`);}
  let pit=0,mx=0;for(let c=0;c<lv.cols;c++){if(grid[11][c]==="#")pit=0;else{pit++;mx=Math.max(mx,pit);}}
  if(bl.length){console.log(lv.name,"SKY-BLOCKERS:",bl.join(" "));bad++;}
  if(mx>2){console.log(lv.name,"PIT",mx);bad++;}
  const hazCols=new Set(spikeCols);
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if(grid[r][c]==="E")hazCols.add(c);
  const tooClose=[];
  for(const hc of hazCols){let d=99;for(const pc of pits)d=Math.min(d,Math.abs(hc-pc));if(d<4)tooClose.push(`${hc}(d${d})`);}
  if(tooClose.length){console.log(lv.name,"HAZARD-NEAR-PIT:",tooClose.join(" "));bad++;}
  const eCols=[];for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if(grid[r][c]==="E")eCols.push(c);
  const crowd=[];for(const ec of eCols)for(const sc of spikeCols)if(Math.abs(ec-sc)<3)crowd.push(`E${ec}~^${sc}`);
  if(crowd.length){console.log(lv.name,"ENEMY-NEAR-SPIKE:",crowd.join(" "));bad++;}
}

function groundBelow(level,x,fr){const c=Math.floor(x/T);for(let r=fr;r<=fr+1;r++)if(level.solidKind(c,r))return true;return false;}
const noop=new Proxy({},{get:()=>()=>{}});
function mkInput(){return{left:false,right:false,dash:false,_j:false,_s:false,consumeJump(){const v=this._j;this._j=false;return v;},consumeSpecial(){const v=this._s;this._s=false;return v;}};}
function play(charKey,def){
  const level=new Level(def);const p=new Player(noop);p.reset(level.spawn,false);
  const input=mkInput();const char=CHARACTERS[charKey];let result=null;
  for(let f=0;f<6000&&!result;f++){
    input.right=true;input.dash=false;
    const footRow=Math.floor((p.y+p.h+4)/T);const frontX=p.x+p.w;
    const pitAhead=groundBelow(level,frontX-2,footRow)&&!groundBelow(level,frontX+T*0.6,footRow);
    let en=false,sp=false;
    for(const e of level.enemies)if(e.alive&&e.x>p.x&&e.x-frontX<T*0.7&&Math.abs(e.y-p.y)<T)en=true;
    for(const s of level.spikes){const[c,r]=s.split(",").map(Number);const sx=c*T;if(sx>p.x&&sx-frontX<T*0.45&&sx-frontX>2&&Math.abs(r*T-p.y)<T*1.2)sp=true;}
    if(p.onGround&&(pitAhead||en||sp))input._j=true;
    result=p.update(level,input,char);
    if(result==="dead")return{ok:false,x:Math.round(p.x),g:level.goal.x};
  }
  return{ok:result==="goal",x:Math.round(p.x),g:level.goal.x};
}
let fails=0;
for(const def of levels){
  const def2={name:def.name,rows:def.lines};
  const r=["dolphin","orca","tetsujin"].map(c=>{const o=play(c,def2);if(!o.ok)fails++;return `${c}:${o.ok?"CLEAR":"x@"+o.x+"/"+o.g}`;});
  console.log(def.name,"->",r.join("  "));
}
if(bad)console.log("VALIDATION ISSUES:",bad);
if(process.env.EMIT && !bad && !fails){
  console.log("=== EMIT ===");
  for(const lv of levels){
    console.log("  {");console.log("    name: "+JSON.stringify(lv.name)+",");console.log("    theme: "+JSON.stringify(lv.theme)+",");console.log("    rows: [");
    for(const l of lv.lines)console.log("      "+JSON.stringify(l)+",");
    console.log("    ],");console.log("  },");
  }
}

if(process.env.TR){
  const lv=levels[+process.env.TR];const level=new Level({name:lv.name,rows:lv.lines});
  console.log("spikes",[...level.spikes],"enemies",level.enemies.map(e=>Math.round(e.x)),"pits-near-start");
  const p=new Player(noop);p.reset(level.spawn,false);const input=mkInput();const char=CHARACTERS.dolphin;let result=null;
  for(let f=0;f<300&&!result;f++){
    input.right=true;
    const footRow=Math.floor((p.y+p.h+4)/T);const frontX=p.x+p.w;
    const pitAhead=groundBelow(level,frontX-2,footRow)&&!groundBelow(level,frontX+T*0.6,footRow);
    let en=false,sp=false;
    for(const e of level.enemies)if(e.alive&&e.x>p.x&&e.x-frontX<T*0.7&&Math.abs(e.y-p.y)<T)en=true;
    for(const s of level.spikes){const[c,r]=s.split(",").map(Number);const sx=c*T;if(sx>p.x&&sx-frontX<T*0.45&&sx-frontX>2&&Math.abs(r*T-p.y)<T*1.2)sp=true;}
    const J=p.onGround&&(pitAhead||en||sp);if(J)input._j=true;
    if(p.x>380&&p.x<620)console.log(`f=${f} x=${Math.round(p.x)} front=${Math.round(frontX)} y=${Math.round(p.y)} grnd=${p.onGround} pit=${pitAhead} en=${en} sp=${sp} J=${J}`);
    result=p.update(level,input,char);
    if(result){console.log("RESULT",result,"x=",Math.round(p.x));break;}
  }
}
