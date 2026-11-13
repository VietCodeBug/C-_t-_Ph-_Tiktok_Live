// Shared seeded placement data for the renderer and the authoritative room.
// These are public courtyards, not playable graph nodes or extra race edges.
export function graphSegments(layout) {
  const nodes=new Map(layout.nodes.map(node=>[node.id,node])),seen=new Set(),segments=[];
  for(const node of layout.nodes)for(const id of node.next||[]){
    const key=[node.id,id].sort().join(':');if(seen.has(key)||!nodes.has(id))continue;
    seen.add(key);segments.push([node.position,nodes.get(id).position]);
  }
  return segments;
}
export function closestOnSegment(position,a,b){
  const dx=b[0]-a[0],dz=b[2]-a[2];
  const t=Math.max(0,Math.min(1,((position[0]-a[0])*dx+(position[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
  return[a[0]+dx*t,0,a[2]+dz*t];
}
export function distanceToSegments(position,segments){
  return Math.min(...segments.map(([a,b])=>{const p=closestOnSegment(position,a,b);return Math.hypot(position[0]-p[0],position[2]-p[2]);}));
}
export function riverAt(layout,z){
  const right=layout.bounds.maxX+5;
  return {center:right+Math.sin(z*.095+1)*1.2+Math.sin(z*.23)*.35,width:layout.theme==='riverside'?5.2:3.7};
}
const jitter=(seed,index)=>{let h=(seed>>>0)^Math.imul(index+1,2654435761);h=Math.imul(h^h>>>16,2246822507);return((h^h>>>13)>>>0)/4294967296;};

export function createWaitingAreas(layout,{count=8}={}){
  const segments=graphSegments(layout),candidates=[],radius=2.55;
  const [landmarkX,,landmarkZ]=layout.landmark?.position||[0,0,-34];
  let serial=0;
  for(let z=layout.bounds.minZ+12;z<=layout.bounds.maxZ-10;z+=1.6)for(let x=-8;x<=8;x+=1.6){
    const position=[x+(jitter(layout.seed,serial++)-.5)*.35,0,z+(jitter(layout.seed,serial++)-.5)*.35];
    if(distanceToSegments(position,segments)<radius+1.75||Math.hypot(position[0]-landmarkX,position[2]-landmarkZ)<radius+5.1)continue;
    const river=riverAt(layout,position[2]);if(Math.abs(position[0]-river.center)<river.width/2+radius+1)continue;
    candidates.push(position);
  }
  const chosen=[];
  const anchors=Array.from({length:count},(_,i)=>[(i%2?1:-1)*3,0,-25+i*7]);
  for(const anchor of anchors){
    const available=candidates.filter(position=>chosen.every(other=>Math.hypot(position[0]-other[0],position[2]-other[2])>=radius*2+.65));
    available.sort((a,b)=>Math.hypot(a[0]-anchor[0],a[2]-anchor[2])-Math.hypot(b[0]-anchor[0],b[2]-anchor[2]));
    if(available.length)chosen.push(available[0]);
  }
  return chosen.map((position,index)=>{
    const closest=segments.map(([a,b])=>closestOnSegment(position,a,b)).sort((a,b)=>Math.hypot(a[0]-position[0],a[2]-position[2])-Math.hypot(b[0]-position[0],b[2]-position[2]))[0];
    const dx=closest[0]-position[0],dz=closest[2]-position[2],length=Math.hypot(dx,dz),nx=dx/length,nz=dz/length;
    const entry=[position[0]+nx*(length-1.25),0,position[2]+nz*(length-1.25)];
    return{id:`WAIT${String(index+1).padStart(2,'0')}`,name:`Sân hẹn ${index+1}`,position:[...position],radius,reserveRadius:radius+.8,spacing:.75,
      slots:Array.from({length:25},(_,slot)=>[position[0]+(slot%5-2)*.75,0,position[2]+(Math.floor(slot/5)-2)*.75]),entry,
      path:[[position[0]+nx*2.2,0,position[2]+nz*2.2],entry]};
  });
}

export function waitingSlotConflicts(layout,bounds,clearance=.3){
  const hits=[];
  for(const area of layout.waitingAreas||[])for(const [index,slot]of area.slots.entries()){
    const x=Math.max(bounds.minX,Math.min(bounds.maxX,slot[0])),z=Math.max(bounds.minZ,Math.min(bounds.maxZ,slot[2]));
    if(Math.hypot(slot[0]-x,slot[2]-z)<clearance)hits.push({areaId:area.id,slot:index});
  }
  return hits;
}
