export type MapRect = { x:number; y:number; w:number; h:number };
type Point = { x:number; y:number };
export type MapRoute = { path:string; start:Point; end:Point; points:Point[] };

// Published survey plates for The Lantern Below. These links are not inferred
// from discovery order; the UI reveals one only when both authored rooms are
// known. Their endpoints remain stable throughout the adventure.
export const LANTERN_SURVEY_ROUTES:Record<string,string> = {
  "inn:outside-inn":"M 210 250 L 265 250",
  "back-room:inn":"M 505 180 L 555 180",
  "inn:kitchen":"M 505 320 L 555 320",
  "kitchen:pantry":"M 740 340 L 790 340",
  "cellar:pantry":"M 870 405 L 870 465",
  "cellar:cellar-passage":"M 790 535 L 740 535",
  "cellar-passage:mothglass":"M 555 535 L 515 535",
  "mothglass:passage":"M 415 620 L 415 685",
  "alcove:passage":"M 315 730 L 270 730",
};

const center=(room:MapRect):Point=>({x:room.x+room.w/2,y:room.y+room.h/2});
const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const crosses=(a:Point,b:Point,room:MapRect)=>{
  const gap=7,left=room.x-gap,right=room.x+room.w+gap,top=room.y-gap,bottom=room.y+room.h+gap;
  if(a.x===b.x)return a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom;
  return a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
};
const ports=(room:MapRect)=>{
  const {x,y,w,h}=room,offset=17;
  return [
    {edge:{x:x+w,y:y+h/2},outside:{x:x+w+offset,y:y+h/2}},
    {edge:{x,y:y+h/2},outside:{x:x-offset,y:y+h/2}},
    {edge:{x:x+w/2,y},outside:{x:x+w/2,y:y-offset}},
    {edge:{x:x+w/2,y:y+h},outside:{x:x+w/2,y:y+h+offset}},
  ];
};
const uniqueSorted=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b);
const compact=(points:Point[])=>points.filter((point,index)=>index===0||index===points.length-1||!((points[index-1].x===point.x&&point.x===points[index+1].x)||(points[index-1].y===point.y&&point.y===points[index+1].y)));

function shortestClearPath(start:Point,end:Point,rooms:MapRect[]) {
  const xs=uniqueSorted([start.x,end.x,0,1100,...rooms.flatMap((room)=>[room.x-16,room.x+room.w+16])]);
  const ys=uniqueSorted([start.y,end.y,0,1100,...rooms.flatMap((room)=>[room.y-16,room.y+room.h+16])]);
  const width=xs.length,origin=ys.indexOf(start.y)*width+xs.indexOf(start.x),goal=ys.indexOf(end.y)*width+xs.indexOf(end.x);
  const point=(node:number):Point=>({x:xs[node%width],y:ys[Math.floor(node/width)]});
  const cost=new Map<number,number>([[origin,0]]),previous=new Map<number,number>();
  const open=[{node:origin,priority:distance(start,end)}];
  while(open.length) {
    // The survey grid is small; selecting the cheapest open intersection is
    // clearer here than maintaining a separate general-purpose heap.
    open.sort((a,b)=>b.priority-a.priority);
    const {node}=open.pop()!;
    if(node===goal)break;
    const current=point(node),col=node%width,row=Math.floor(node/width);
    for(const neighbour of [col>0?node-1:-1,col<width-1?node+1:-1,row>0?node-width:-1,row<ys.length-1?node+width:-1]) {
      if(neighbour<0)continue;
      const next=point(neighbour);
      if(rooms.some((room)=>crosses(current,next,room)))continue;
      const nextCost=cost.get(node)!+distance(current,next);
      if(nextCost>=(cost.get(neighbour)??Infinity))continue;
      cost.set(neighbour,nextCost);
      previous.set(neighbour,node);
      open.push({node:neighbour,priority:nextCost+distance(next,end)});
    }
  }
  if(!cost.has(goal))return null;
  const path=[goal];
  while(path[0]!==origin)path.unshift(previous.get(path[0])!);
  return compact(path.map(point));
}

// Connect room thresholds using rectilinear paths outside every discovered
// room. The graph comes only from visible rooms; it cannot invent exits.
export function routeBetweenRooms(from:MapRect,to:MapRect,otherRooms:MapRect[]=[]):MapRoute {
  const rooms=[from,to,...otherRooms];
  const candidates=ports(from).flatMap((start)=>ports(to).map((end)=>{
    const clear=shortestClearPath(start.outside,end.outside,rooms);
    if(!clear)return null;
    const points=compact([start.edge,...clear,end.edge]);
    const bends=points.slice(1,-1).filter((point,index)=>index>0&&
      (points[index-1].x===point.x)!==(point.x===points[index+1].x)).length;
    const length=points.slice(1).reduce((total,point,index)=>total+distance(points[index],point),0);
    return {points,score:length+bends*8};
  })).filter((candidate):candidate is {points:Point[];score:number}=>Boolean(candidate));
  const points=candidates.sort((left,right)=>left.score-right.score)[0]?.points
    || [center(from),center(to)];
  return {path:points.map((point,index)=>`${index?"L":"M"} ${point.x} ${point.y}`).join(" "),start:points[0],end:points.at(-1)!,points};
}
