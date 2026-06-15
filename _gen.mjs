/**
 * _gen.mjs — レベルの生成・検証ツール（開発用）。
 * `node _gen.mjs` で src/data/levels.js と同じ5ステージを組み立て、
 *   ・穴は2タイル幅か / 穴・トゲ上空(ジャンプ到達域 rows6-10)に固いタイルが無いか
 *   ・トゲ/敵は穴の縁から4列以上 / 敵とトゲは3列以上離れているか
 * を検証し、さらに実際の Level/Player 物理で 3キャラ全員が歩きジャンプのみで
 * 全ステージ走破できるか（CLEAR）を確認する。
 * `EMIT=1 node _gen.mjs` で levels.js に貼れる形（theme 付き）を出力する。
 */
import { writeFileSync } from "fs";
import { Level } from "./src/modules/Level.js";
import { Player } from "./src/modules/Player.js";
import { CHARACTERS } from "./src/data/characters.js";
const T = 48;
const noop=new Proxy({},{get:()=>()=>{}});   // 音などを無視するスタブ（genGood が早期に使う）
function buildGround(spans, cols){const a=Array(cols).fill(" ");for(const[s,e]of spans)for(let c=s;c<=e;c++)a[c]="#";return a.join("");}
function pitCols(spans, cols){const sset=new Set();for(const[s,e]of spans)for(let c=s;c<=e;c++)sset.add(c);const p=new Set();for(let c=0;c<cols;c++)if(!sset.has(c))p.add(c);return p;}
function run(r,c0,str){const o=[];for(let i=0;i<str.length;i++)if(str[i]!==" ")o.push([r,c0+i,str[i]]);return o;}
function makeLevel(name,theme,cols,spans,places){
  const grid=Array.from({length:14},()=>Array(cols).fill(" "));
  for(let r=11;r<=13;r++)grid[r]=buildGround(spans,cols).split("");
  for(const[r,c,ch]of places)grid[r][c]=ch;
  return {name,theme,cols,spans,lines:grid.map(a=>a.join("").replace(/\s+$/,""))};
}

// ── 自動生成（長くて難しいコース）─────────────────────────────
// 設計ルールを満たすように配置するので、あとはボット踏破でシードを選べばよい。
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function genLevel(name, theme, cols, diff, seed){
  const rnd = mulberry32(seed); const ri = (n)=>Math.floor(rnd()*n);
  const grid = Array.from({length:14}, ()=>Array(cols).fill(" "));
  const put=(r,c,ch)=>{ if(c>=0&&c<cols&&r>=0&&r<14) grid[r][c]=ch; };
  // 1) 2タイル穴を挟みながら地面スパンを作る（難度が上がるほどスパンは短く＝穴が多い）
  const spans=[]; const pitSet=new Set(); let s=0;
  while(s<cols){
    let w=Math.max(6,(12-diff)-ri(3));
    let e=s+w-1;
    if(e+5>=cols-1){ spans.push([s,cols-1]); break; }
    spans.push([s,e]); pitSet.add(e+1); pitSet.add(e+2); s=e+3;
  }
  for(let r=11;r<=13;r++)for(let c=0;c<cols;c++)grid[r][c]=pitSet.has(c)?" ":"#";
  // 2) P / G
  put(10,1,"P");
  const last=spans[spans.length-1]; put(10,Math.min(cols-2,last[1]-1),"G");
  const spikeCols=new Set(), enemyCols=new Set(), pipeCols=new Set();
  // 3) 危険物（トゲ/クリボー/ノコノコ）：各スパンの安全帯（穴縁から4以上）に、3以上離して配置
  spans.forEach((sp,i)=>{
    const [a,b]=sp; const w=b-a+1; const first=i===0, lastSp=i===spans.length-1;
    const lo=a+(first?7:4), hi=b-(lastSp?7:4);
    if(hi<lo) return;
    let n = first||lastSp ? 0 : 1 + ((diff>=2&&w>=10&&rnd()<0.6)?1:0);
    const placed=[];
    for(let k=0;k<n;k++){
      let hc=-1,tr=0; while(tr++<12){const cand=lo+ri(hi-lo+1); if(placed.every(p=>Math.abs(p-cand)>=3)){hc=cand;break;}}
      if(hc<0)break; placed.push(hc);
      const roll=rnd();
      if(roll<0.5){put(10,hc,"^");spikeCols.add(hc);}
      else if(roll<0.78){put(10,hc,"E");enemyCols.add(hc);}
      else {put(10,hc,"K");enemyCols.add(hc);}
    }
  });
  // 4) 土管＋パックン（中盤以降・広いスパンに1つまで・上に物を置かない）
  if(diff>=1 && rnd()<0.7){
    for(const sp of spans.slice(1,-1)){ const [a,b]=sp; if(b-a>=10){ const cc=a+5+ri(Math.max(1,b-a-9));
      if(grid[10][cc]===" "&&grid[10][cc-1]===" "&&grid[10][cc+1]===" "){ put(10,cc,"p");put(9,cc,"p");put(8,cc,"F");pipeCols.add(cc);break; } } }
  }
  // 5) ？/レンガ（row7・固い地面の上・トゲや土管の上は避ける）
  spans.forEach((sp)=>{
    const [a,b]=sp; const w=b-a+1; if(w<8||rnd()<0.45) return;
    let bc=-1,tr=0; while(tr++<12){const cand=a+2+ri(w-4); if(!spikeCols.has(cand)&&!pipeCols.has(cand)){bc=cand;break;}}
    if(bc<0)return; put(7,bc, rnd()<0.45?"?":"B");
    if(diff>=2&&rnd()<0.4&&!spikeCols.has(bc+2)&&!pipeCols.has(bc+2)) put(7,bc+2, rnd()<0.5?"?":"B");
  });
  // 6) 高所ボーナス足場(row3)＋コイン(row2)：ジャンプ到達域より上なのでどこでも可
  spans.forEach((sp)=>{ const [a,b]=sp; const w=b-a+1; if(w<8||rnd()<0.5)return;
    const pc=a+1+ri(Math.max(1,w-6)); const pw=4+ri(3);
    for(let c=pc;c<pc+pw&&c<=b;c++)put(3,c,"=");
    for(let c=pc;c<pc+pw&&c<=b;c+=2)put(2,c,"o"); });
  // 7) コイン：穴の上(row9・誘導)と地面上
  for(const c of pitSet) if(rnd()<0.85) put(9,c,"o");
  spans.forEach(sp=>{ const[a,b]=sp; if(b-a>=5&&rnd()<0.6){ const cc=a+2+ri(Math.max(1,b-a-3)); put(9,cc,"o"); put(9,cc+2,"o"); }});
  // 8) バネ（中盤以降・固い地面の空きセル）
  if(diff>=1){ for(const sp of spans){ const[a,b]=sp; if(b-a>=8&&rnd()<0.35){ const cc=a+4+ri(Math.max(1,b-a-7)); if(grid[10][cc]===" "&&grid[11][cc]==="#"){put(10,cc,"S");break;} } } }
  // 9) 動く床（終盤・穴の上）＋上にコイン
  if(diff>=2){ const arr=[...pitSet].sort((x,y)=>x-y); if(arr.length){ const pc=arr[Math.floor(arr.length/2)]; if(grid[7][pc]===" "){ put(8,pc,"-"); put(6,pc-1,"o");put(6,pc+1,"o"); } } }
  // 10) 進化アイテム M（1〜2個・固い地面の空き・危険物を避ける）
  let mN=0, mMax=1+(diff>=3?1:0);
  for(const sp of spans){ if(mN>=mMax)break; const[a,b]=sp; const cc=Math.floor((a+b)/2);
    if(grid[10][cc]===" "&&grid[11][cc]==="#"&&!spikeCols.has(cc)&&!enemyCols.has(cc)){put(10,cc,"M");mN++;} }
  // 11) 中間地点（長いほど複数）：固い地面の空きセル
  const cps = cols>=100?[0.34,0.66] : [0.5];
  for(const f of cps){ let base=Math.round(cols*f); let done=false;
    for(let d=0;d<7&&!done;d++)for(const cand of [base+d,base-d]){ if(cand>3&&cand<cols-4&&grid[11][cand]==="#"&&grid[10][cand]===" "){put(10,cand,"C");done=true;break;} } }
  return {name,theme,cols,spans,lines:grid.map(a=>a.join("").replace(/\s+$/,""))};
}

// 1ステージ分の幾何ルール違反数（0なら合格）
function validateGeometry(lv){
  const pits=pitCols(lv.spans,lv.cols);
  const grid=lv.lines.map(l=>l.padEnd(lv.cols," "));
  const spikeCols=new Set();
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if(grid[r][c]==="^")spikeCols.add(c);
  const hazard=new Set([...pits,...spikeCols]); let bad=0;
  for(const c of hazard)for(let r=6;r<=10;r++){const ch=grid[r][c];if("=B#?".includes(ch))bad++;}
  let pit=0,mx=0;for(let c=0;c<lv.cols;c++){if(grid[11][c]==="#")pit=0;else{pit++;mx=Math.max(mx,pit);}}
  if(mx>2)bad++;
  const hazCols=new Set(spikeCols);
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if("EK".includes(grid[r][c]))hazCols.add(c);
  for(const hc of hazCols){let d=99;for(const pc of pits)d=Math.min(d,Math.abs(hc-pc));if(d<4)bad++;}
  const eCols=[];for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if("EK".includes(grid[r][c]))eCols.push(c);
  for(const ec of eCols)for(const sc of spikeCols)if(Math.abs(ec-sc)<3)bad++;
  return bad;
}

// ルール合格＆3キャラ踏破できるシードを探して採用する
function genGood(name,theme,cols,diff){
  for(let seed=1;seed<800;seed++){
    const lv=genLevel(name,theme,cols,diff,seed);
    if(validateGeometry(lv)!==0) continue;
    const def={name,rows:lv.lines};
    if(["dolphin","orca","tetsujin"].every(c=>play(c,def).ok)){ lv._seed=seed; return lv; }
  }
  console.log("WARN: no good seed for",name);
  return genLevel(name,theme,cols,diff,1);
}

const L1=makeLevel("1. なみのりビーチ","ocean",62,[[0,9],[12,23],[26,39],[42,61]],[
  ...run(3,15,"========"),...run(2,16,"o o o"),...run(7,44,"B ? B"),...run(7,20,"?"),
  ...run(9,10,"o o   o o"),...run(9,24,"o o"),...run(8,30,"o o o"),
  [10,30,"p"],[9,30,"p"],[8,30,"F"],   // 土管＋パックンフラワー（広い区画に配置）
  [10,27,"C"],[10,46,"S"],             // 中間地点＋バネ
  [10,18,"M"],[10,1,"P"],[10,6,"E"],[10,17,"^"],[10,36,"E"],[10,50,"E"],[10,59,"G"],
]);
const L2=makeLevel("2. どうくつケーブ","cave",58,[[0,11],[14,23],[26,37],[40,57]],[
  ...run(3,16,"======="),...run(2,17,"o o o"),...run(7,2,"B B"),...run(7,30,"? B"),
  ...run(9,12,"o o"),...run(9,24,"o o"),...run(9,38,"o o"),...run(8,44,"o o o"),
  [10,30,"M"],[10,27,"C"],[10,1,"P"],[10,7,"E"],[10,20,"^"],[10,32,"E"],[10,45,"^"],[10,53,"G"],
]);
const L3=makeLevel("3. すいちゅうダイブ","water",60,[[0,9],[12,22],[25,35],[38,48],[51,59]],[
  ...run(3,14,"========"),...run(2,15,"o o o"),...run(7,52,"B ? B"),...run(7,29,"?"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,36,"o o"),...run(9,49,"o o"),...run(8,28,"o o o"),
  [10,31,"M"],[10,33,"C"],[10,1,"P"],[10,6,"E"],[10,18,"^"],[10,28,"K"],[10,42,"^"],[10,45,"E"],[10,57,"G"],
]);
const L4=makeLevel("4. どかんパイプ","pipe",64,[[0,9],[12,22],[25,38],[41,52],[55,63]],[
  ...run(3,15,"========"),...run(2,16,"o o o"),...run(3,44,"======"),...run(2,45,"o o o"),
  ...run(7,4,"B B"),...run(7,30,"? ?"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,39,"o o"),...run(9,53,"o o"),...run(8,28,"o o o"),
  [10,26,"M"],[10,31,"C"],[10,1,"P"],[10,17,"^"],[10,29,"E"],[10,33,"^"],[10,46,"E"],[10,58,"^"],[10,62,"G"],
]);
const L5=makeLevel("5. そらのかいどう","sky",72,[[0,9],[12,22],[25,36],[39,49],[52,62],[65,71]],[
  ...run(3,14,"========"),...run(2,15,"o o o"),...run(3,52,"======"),...run(2,53,"o o o"),...run(7,26,"B ? B"),...run(7,33,"?"),
  ...run(9,10,"o o"),...run(9,23,"o o"),...run(9,50,"o o"),...run(9,63,"o o"),[8,38,"-"],...run(6,37,"o o o"),
  [10,30,"M"],[10,33,"C"],[10,1,"P"],[10,6,"E"],[10,17,"^"],[10,28,"K"],[10,42,"^"],[10,46,"E"],[10,57,"^"],[10,69,"G"],
]);
// 後半：自動生成の「長くて難しい」コース（難度・長さが上がっていく）
const L6=genGood("6. ヒートシティ","city",92,2);
const L7=genGood("7. ふかいどうくつ","cave",104,3);
const L8=genGood("8. だいかいえんダイブ","water",112,3);
const L9=genGood("9. ラストフォートレス","sky",124,4);
const levels=[L1,L2,L3,L4,L5,L6,L7,L8,L9];

let bad=0;
for(const lv of levels){
  const pits=pitCols(lv.spans,lv.cols);
  const grid=lv.lines.map(l=>l.padEnd(lv.cols," "));
  const spikeCols=new Set();
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if(grid[r][c]==="^")spikeCols.add(c);
  const hazard=new Set([...pits,...spikeCols]);
  const bl=[];
  for(const c of hazard)for(let r=6;r<=10;r++){const ch=grid[r][c];if("=B#?".includes(ch))bl.push(`${ch}@(${c},${r})`);}
  let pit=0,mx=0;for(let c=0;c<lv.cols;c++){if(grid[11][c]==="#")pit=0;else{pit++;mx=Math.max(mx,pit);}}
  if(bl.length){console.log(lv.name,"SKY-BLOCKERS:",bl.join(" "));bad++;}
  if(mx>2){console.log(lv.name,"PIT",mx);bad++;}
  const hazCols=new Set(spikeCols);
  for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if("EK".includes(grid[r][c]))hazCols.add(c);
  const tooClose=[];
  for(const hc of hazCols){let d=99;for(const pc of pits)d=Math.min(d,Math.abs(hc-pc));if(d<4)tooClose.push(`${hc}(d${d})`);}
  if(tooClose.length){console.log(lv.name,"HAZARD-NEAR-PIT:",tooClose.join(" "));bad++;}
  const eCols=[];for(let r=0;r<grid.length;r++)for(let c=0;c<lv.cols;c++)if("EK".includes(grid[r][c]))eCols.push(c);
  const crowd=[];for(const ec of eCols)for(const sc of spikeCols)if(Math.abs(ec-sc)<3)crowd.push(`E${ec}~^${sc}`);
  if(crowd.length){console.log(lv.name,"ENEMY-NEAR-SPIKE:",crowd.join(" "));bad++;}
}

function groundBelow(level,x,fr){const c=Math.floor(x/T);for(let r=fr;r<=fr+1;r++)if(level.solidKind(c,r))return true;return false;}
function mkInput(){return{left:false,right:false,dash:false,_j:false,_s:false,consumeJump(){const v=this._j;this._j=false;return v;},consumeSpecial(){const v=this._s;this._s=false;return v;}};}
function play(charKey,def){
  const level=new Level(def);const p=new Player(noop);p.reset(level.spawn,false);
  const input=mkInput();const char=CHARACTERS[charKey];let result=null;
  for(let f=0;f<6000&&!result;f++){
    // 敵は動かさず「地形が歩きジャンプで踏破可能か」を検証する（敵の動きはブラウザで確認）
    input.right=true;input.dash=false;
    const footRow=Math.floor((p.y+p.h+4)/T);const frontX=p.x+p.w;
    const pitAhead=groundBelow(level,frontX-2,footRow)&&!groundBelow(level,frontX+T*0.6,footRow);
    const wallAhead=!!level.solidKind(Math.floor((frontX+6)/T),footRow-1); // 土管などの壁
    let en=false,sp=false;
    for(const e of level.enemies)if(e.alive&&e.x>p.x&&e.x-frontX<T*1.05&&Math.abs(e.y-p.y)<T)en=true;
    for(const s of level.spikes){const[c,r]=s.split(",").map(Number);const sx=c*T;if(sx>p.x&&sx-frontX<T*0.45&&sx-frontX>2&&Math.abs(r*T-p.y)<T*1.2)sp=true;}
    if(p.onGround&&(pitAhead||en||sp||wallAhead))input._j=true;
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

// WRITE=1 で src/data/levels.js を検証済みデータそのままで書き出す（手作業同期の事故防止）
if(process.env.WRITE && !bad && !fails){
  const header = `/**
 * ステージデータ（ASCIIタイルマップ）。_gen.mjs が自動生成＆検証して書き出す（手で編集しない）。
 * 凡例:
 *   '#' 地面/壁   '=' 足場   'B' レンガ(頭突きでコイン/進化中は破壊)   '?' ？ブロック(頭突きでアイテム)
 *   'o' コイン   '^' トゲ   'E' クリボー   'K' ノコノコ(踏むと甲羅)   'p' 土管   'F' パックンフラワー
 *   'S' バネ   'C' 中間地点   '-' 動く床   'M' 進化アイテム   'P' 開始   'G' ゴール   ' ' 空白
 * theme: 'ocean'|'cave'|'water'|'pipe'|'sky'|'city'
 * 3キャラ全員が歩きジャンプのみで全ステージ走破可能なことを実機物理で検証ずみ。
 */
export const TILE = 48;

export const LEVELS = [
`;
  let body = '';
  for(const lv of levels){
    body += "  {\n    name: "+JSON.stringify(lv.name)+",\n    theme: "+JSON.stringify(lv.theme)+",\n    rows: [\n";
    for(const l of lv.lines) body += "      "+JSON.stringify(l)+",\n";
    body += "    ],\n  },\n";
  }
  writeFileSync(new URL("./src/data/levels.js", import.meta.url), header + body + "];\n");
  console.log("WROTE src/data/levels.js");
}
if(process.env.EMIT && !bad && !fails){
  console.log("=== EMIT ===");
  for(const lv of levels){
    console.log("  {");console.log("    name: "+JSON.stringify(lv.name)+",");console.log("    theme: "+JSON.stringify(lv.theme)+",");console.log("    rows: [");
    for(const l of lv.lines)console.log("      "+JSON.stringify(l)+",");
    console.log("    ],");console.log("  },");
  }
}

if(process.env.TR){
  const li=+process.env.TR; const def={name:levels[li].name,rows:levels[li].lines};
  const level=new Level(def); const p=new Player(noop); p.reset(level.spawn,false);
  console.log('enemies', level.enemies.map(e=>`${e.type}@${Math.round(e.x)}`).join(' '));
  const input=mkInput(); const char=CHARACTERS[process.env.CK||'tetsujin']; let result=null;
  const lo=+(process.env.LO||0), hi=+(process.env.HI||999999);
  for(let f=0;f<6000&&!result;f++){
    level.update(p,null);
    input.right=true;
    const footRow=Math.floor((p.y+p.h+4)/T);const frontX=p.x+p.w;
    const pitAhead=groundBelow(level,frontX-2,footRow)&&!groundBelow(level,frontX+T*0.6,footRow);
    let en=false,sp=false;
    for(const e of level.enemies)if(e.alive&&e.x>p.x&&e.x-frontX<T*1.05&&Math.abs(e.y-p.y)<T)en=true;
    for(const s of level.spikes){const[c,r]=s.split(',').map(Number);const sx=c*T;if(sx>p.x&&sx-frontX<T*0.45&&sx-frontX>2&&Math.abs(r*T-p.y)<T*1.2)sp=true;}
    const J=p.onGround&&(pitAhead||en||sp); if(J)input._j=true;
    if(p.x>lo&&p.x<hi){const near=level.enemies.filter(e=>e.alive&&Math.abs(e.x-p.x)<120).map(e=>`${e.type}:${e.state}@${Math.round(e.x)}`).join(',');
      console.log(`f=${f} x=${Math.round(p.x)} y=${Math.round(p.y)} grnd=${p.onGround} pit=${pitAhead} en=${en} J=${J} [${near}]`);}
    result=p.update(level,input,char);
    if(result){console.log('RESULT',result,'x=',Math.round(p.x));break;}
  }
}
