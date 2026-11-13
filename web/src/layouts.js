import {createWaitingAreas} from './waiting-areas.js';
// Runtime town variants. Source GLBs/24-node handoff remain untouched.
export const NEIGHBORHOODS = {
  CHO_VIA_HE: { name: 'Chợ Vỉa Hè', theme: 'market', story: 'Phiên chợ sớm · cả phố cùng chốt đơn' },
  PHO_GIAO_HANG: { name: 'Phố Giao Hàng', theme: 'delivery', story: 'Ca giao hàng · chuyến cuối qua phố' },
  BEN_SONG: { name: 'Bến Sông', theme: 'riverside', story: 'Hội chợ ven sông · hẹn nhau ở bến' }
};

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const FORK_STARTS = [4, 20, 36, 52, 68, 84];
const CATEGORY_NAMES = ['Ga phố', 'Nhặt tiền', 'Mất tiền', 'Chuyện phố', 'Đầu tư', 'Buôn bán', 'Nghỉ chân', 'Mini game'];
const DISTRICTS = [
  { name: 'Hẻm Khởi Nghiệp', story: 'Quán mới mở · cơ hội nhỏ, chuyện vui to' },
  { name: 'Chợ Bến Nước', story: 'Chợ đông người · chốt đơn hay quay xe?' },
  { name: 'Đồi Hội Phố', story: 'Lên đồi dự hội · ngắm phố từ tháp đồng hồ' },
  { name: 'Xóm Vườn Mát', story: 'Hẻm cây xanh · đi chậm, giữ ví' }
];

const quietPatternCache=new Map();
function quietPattern(random,stationBlock,branchQuiet){
  const key=`${stationBlock}:${branchQuiet}`;
  if(!quietPatternCache.has(key)){
    const patterns=[];
    function choose(start,active){
      if(active.length===6){
        const set=new Set(active);
        if(stationBlock&&(!set.has(0)||!set.has(1)||set.has(2)))return;
        if(active.filter(i=>i>=5&&i<=11).length!==7-branchQuiet)return;
        for(let i=0;i<13;i++)if(set.has(i)&&set.has(i+1)&&set.has(i+2))return;
        patterns.push(Array.from({length:16},(_,i)=>!set.has(i)));return;
      }
      for(let i=start;i<15;i++)choose(i+1,[...active,i]);
    }
    choose(0,[]);quietPatternCache.set(key,patterns);
  }
  const patterns=quietPatternCache.get(key);return patterns[Math.floor(random()*patterns.length)];
}
function quietMask(random){return Array.from({length:6},(_,index)=>quietPattern(random,index===0||index===3,index%2?5:4)).flat();}

// Resample a closed, gently rounded serpentine outline at equal walking lengths.
// The waypoints create six deep street bends rather than another ellipse.
function streetOutline(random) {
  const source = [[0,39],[11,36],[20,29],[15,20],[22,11],[15,1],[22,-10],[16,-21],[20,-31],[10,-39],
    [0,-41],[-11,-37],[-20,-29],[-15,-20],[-22,-11],[-15,-1],[-22,10],[-16,21],[-20,31],[-10,38]];
  const sx = .96 + random() * .07, sz = .98 + random() * .04;
  const points = source.map(([x,z],i) => [x * sx + (i % 10 ? (random()-.5)*.8 : 0),z * sz + (random()-.5)*.65]);
  const curve = [];
  for (let i = 0; i < points.length; i++) {
    const p0=points[(i+points.length-1)%points.length],p1=points[i],p2=points[(i+1)%points.length],p3=points[(i+2)%points.length];
    for (let j=0;j<80;j++) {
      const t=j/80,t2=t*t,t3=t2*t;
      curve.push([0,1].map(axis => .5*((2*p1[axis])+(-p0[axis]+p2[axis])*t+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*t2+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*t3)));
    }
  }
  curve.push(curve[0]);
  const distance=[0];
  for(let i=1;i<curve.length;i++) distance.push(distance.at(-1)+Math.hypot(curve[i][0]-curve[i-1][0],curve[i][1]-curve[i-1][1]));
  let at=1;
  return Array.from({length:96},(_,i)=>{
    const target=distance.at(-1)*i/96;
    while(distance[at]<target) at++;
    const t=(target-distance[at-1])/(distance[at]-distance[at-1]);
    return [curve[at-1][0]*(1-t)+curve[at][0]*t,0,curve[at-1][1]*(1-t)+curve[at][1]*t];
  });
}

export function createTownLayout(id, seed = 1) {
  const config = NEIGHBORHOODS[id];
  if (!config) throw new Error('Unknown neighborhood: ' + id);
  const random = seededRandom(seed);
  const positions = streetOutline(random);
  const quiet=quietMask(random),categoryBag=[1,1,1,2,2,3,3,4,5,7];
  const nodes = Array.from({ length: 96 }, (_, i) => {
    const district = DISTRICTS[Math.floor(i/24)];
    return {
      id: `C${String(i).padStart(2, '0')}`,
      position: positions[i], width: 2, next: [`C${String((i + 1) % 96).padStart(2, '0')}`],
      station: i === 0 || i === 48, fork: FORK_STARTS.includes(i),
      district: district.name, story: district.story,
      typeIndex: i === 0 || i === 48 ? 0 : quiet[i]?6:categoryBag[Math.floor(random()*categoryBag.length)]
    };
  });
  nodes[1].typeIndex=nodes[49].typeIndex=1;
  nodes[2].typeIndex=nodes[50].typeIndex=6;
  // Every map keeps all eight categories, while the event-free mask controls
  // density independently. Stations and their introductory gain tiles stay put.
  const eventIndices=nodes.map((node,index)=>({node,index})).filter(({node,index})=>!node.station&&node.typeIndex!==6&&index!==1&&index!==49).map(({index})=>index);
  for(let i=eventIndices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[eventIndices[i],eventIndices[j]]=[eventIndices[j],eventIndices[i]];}
  [1,2,3,4,5,7].forEach((category,index)=>{nodes[eventIndices[index]].typeIndex=category;});
  // Both ways take eight edges. The inner lane bends away from the outer street.
  for (const [index,start] of FORK_STARTS.entries()) {
    const fork=index+1;
    const end = start + 8;
    const a = nodes[start].position, b = nodes[end].position;
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const inward=[(b[2]-a[2])/length,-(b[0]-a[0])/length];
    const depth=9.8+random()*.5;
    const branch = [];
    let eventAt=0;
    for (let j = 1; j <= 7; j++) {
      const t = j / 8;
      branch.push({ id: `F0${fork}_${j}`, position: [
        a[0] * (1 - t) + b[0] * t + inward[0]*Math.sin(t*Math.PI)*depth,
        0, a[2] * (1 - t) + b[2] * t + inward[1]*Math.sin(t*Math.PI)*depth
      ], width: 2, next: [j === 7 ? nodes[end].id : `F0${fork}_${j + 1}`],
      station: false, fork: false,
      district: index%2 ? 'Ngõ Vườn An Yên' : 'Hẻm Chợ Náo Nhiệt',
      story: index%2 ? 'Đường vòng qua vườn · nhặt tiền, nghỉ chân' : 'Lách qua sạp nhỏ · buôn bán và chuyện bất ngờ',
      typeIndex: nodes[start+j].typeIndex===6?6:(index%2?[1,4,1]:[5,2,3])[eventAt++] });
    }
    nodes[start].next.push(branch[0].id);
    nodes.push(...branch);
    const leftIsMain=nodes[start+1].position[0]<branch[0].position[0];
    nodes[start].choiceOrder=leftIsMain?['left','right']:['right','left'];
    nodes[start].choices=nodes[start].next.map((target,k)=>({
      direction:nodes[start].choiceOrder[k],target,
      name:k ? (index%2?'Ngõ vườn an toàn':'Hẻm chợ đông vui'):'Đường phố lớn',
      district:k?branch[0].district:nodes[start+1].district,
      preview:(k?branch.slice(0,3):nodes.slice(start+1,start+4)).map(n=>CATEGORY_NAMES[n.typeIndex]),
      risk:k?(index%2?'Nhẹ nhàng':'Có lời, có phí'):'Chuyện phố ngẫu nhiên'
    }));
  }
  const byId=new Map(nodes.map(node=>[node.id,node]));
  for(const [index,node]of nodes.entries()){
    const previous=index<96?nodes[(index+95)%96]:nodes.find(candidate=>candidate.next.includes(node.id));
    const next=byId.get(node.next[0]),dx=next.position[0]-previous.position[0],dz=next.position[2]-previous.position[2],length=Math.hypot(dx,dz)||1;
    node.heading=[dx/length,0,dz/length];node.yaw=Math.atan2(dx,dz);
  }
  const layout={ ...config, id, seed: seed >>> 0, procedural: true, nodes,
    districts:DISTRICTS, landmark:{name:'Đồi Hội Phố',position:[0,0,-34]},
    file: `generated-${id}-${seed >>> 0}`, tile_width: 2, lapSteps: 96,
    bounds: { minX: Math.min(...nodes.map(n => n.position[0])), maxX: Math.max(...nodes.map(n => n.position[0])),
      minZ: Math.min(...nodes.map(n => n.position[2])), maxZ: Math.max(...nodes.map(n => n.position[2])) } };
  layout.waitingAreas=createWaitingAreas(layout);layout.quiet={perLap:60,lapNodes:96,total:nodes.filter(node=>node.typeIndex===6).length};
  return layout;
}

export function createTownLayouts(seed) {
  return Object.fromEntries(Object.keys(NEIGHBORHOODS).map((id, i) => [id, createTownLayout(id, (seed + i * 7919) >>> 0)]));
}
