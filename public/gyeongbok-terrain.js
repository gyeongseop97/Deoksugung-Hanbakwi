import {gbEastWallX,insideGbWall,onGbWestPath} from "./gyeongbok-perimeter.js";
import {court,hall,middle,palacePond,stoneFountain,stoneHall,ticket} from "./layout.js";
import {plazaSites} from "./plaza-layout.js";

const gate=plazaSites.gate;
// Smoothed elevations in metres from the public 30 m SRTM surface. Ponds and
// their banks share a level within each basin.
const palaceProfile=[[0,0],[120,.65],[225,2.8],[320,4.25],[370,5.4],[480,7.2],
  [560,10.8],[625,13.8],[665,15.8],[749,15.8],[820,19.2],[880,21.1]];
const samcheongProfile=[[-890,0],[-1030,1],[-1145,.8],[-1280,2],[-1400,3],[-1515,6],[-1660,12],[-1780,16],[-1890,18]];
const sejongProfile=[[-905,0],[-840,.1],[-750,-.3],[-620,-.75],[-495,-1.2],[-355,-1.85],
  [-260,-2.7],[-130,-4.3],[-45,-4.8],[35,-3.95],[115,-3.35],[205,-3.1],[295,-3.15],[450,-2.7]];
const gardenProfile=[[6,6.1],[70,5.4],[140,4.3],[216,3.05],[300,2.0],[386,.9],[450,.2]];
const levelPads=[
  [stoneHall,34,24,.85],[stoneFountain,12,12,.90],[palacePond,23,23,.15],
  [hall,18,17,-.10],[court,20,13,-.20],[middle,13,13,-.26],[ticket,7,5,-3.16]
];
const clamp=value=>Math.max(0,Math.min(1,value));
function profileAt(value,profile,direction){
  for(let i=1;i<profile.length;i++){
    const [start,low]=profile[i-1],[end,high]=profile[i];
    if((value-end)*direction<=0)return low+(high-low)*clamp((value-start)/(end-start));
  }
  return profile.at(-1)[1];
}
export const samcheongLevel=y=>profileAt(y,samcheongProfile,-1);
// The southern avenue valley and the higher Jeongdong grounds join at the
// avenue sidewalks. Reduce SRTM building/foliage spikes to the street grade.
export function southWorldTerrainHeight({x,y}){
  const street=profileAt(y,sejongProfile,1);
  const west=clamp((485-x)/410);
  const south=clamp((y+200)/230);
  const garden=profileAt(y,gardenProfile,1)+west*4.5;
  let level=street+garden*clamp((474-x)/160)*south;
  const east=clamp((x-560)/200),sogong=clamp((y-155)/85)*clamp((490-y)/65);
  level+=east*sogong*2.6;
  for(const [site,w,d,base] of levelPads){
    const gap=Math.max(Math.abs(x-site.x)-w,Math.abs(y-site.y)-d,0);
    level+=(base-level)*clamp(1-gap/15);
  }
  // Keep the plaza road and palace entrance at the same height.
  const gateBlend=clamp((y-gate.y)/55);
  return level*gateBlend;
}

export function outsideGroundOffset({x,y}){
  if(y>=gate.y)return southWorldTerrainHeight({x,y});
  return palaceGroundOffset(x,y);
}
export function gyeongbokTerrainHeight({x,y}){
  const north=gate.y-y;
  if(north<=0||north>910||Math.abs(x-gate.x)>330)return 0;
  const east=x-gate.x;
  let level=profileAt(north,palaceProfile,1);
  if(east>=-198&&east<=-59&&north>=353&&north<=495)level=6.2;
  else if(east>-219&&east<-39&&north>331&&north<517){
    const margin=Math.min(east+219,-39-east,north-331,517-north);
    level+=(6.2-level)*clamp(margin/22);
  }
  const boundary=gbEastWallX(y);
  const edge=boundary==null?0:clamp((x-boundary+74)/74);
  return level+(samcheongLevel(y)-level)*edge;
}

export function palaceGroundOffset(x,y){
  return insideGbWall(x,y)||onGbWestPath(x,y)?gyeongbokTerrainHeight({x,y}):0;
}

// The pavilion and trees stand upright. Ground and wall meshes follow the
// terrain at their own vertices so long paths meet the ground along their edges.
export function* gradePalaceMeshes(T,objects,height=gyeongbokTerrainHeight){
  const vertex=new T.Vector3(),other=new T.Vector3(),matrix=new T.Matrix4(),inverse=new T.Matrix4();
  let count=0;
  for(const object of objects){
    if(object.userData.flatBackground)continue;
    if(object.userData.followTerrain){
      object.updateMatrix();
      matrix.copy(object.matrix);inverse.copy(matrix).invert();
      const old=object.geometry,source=old.index?old.toNonIndexed():old;
      const pos=source.attributes.position,uv=source.attributes.uv,vertices=[],texels=[];
      const read=index=>[pos.getX(index),pos.getY(index),pos.getZ(index),uv?.getX(index)??0,uv?.getY(index)??0];
      function distance(a,b){return vertex.fromArray(a).applyMatrix4(matrix).distanceTo(other.fromArray(b).applyMatrix4(matrix));}
      function triangle(a,b,c){
        const ab=distance(a,b),bc=distance(b,c),ca=distance(c,a);
        if(Math.max(ab,bc,ca)>23){
          if(ab>=bc&&ab>=ca){const m=a.map((value,i)=>(value+b[i])/2);triangle(a,m,c);triangle(m,b,c);}
          else if(bc>=ca){const m=b.map((value,i)=>(value+c[i])/2);triangle(a,b,m);triangle(a,m,c);}
          else{const m=c.map((value,i)=>(value+a[i])/2);triangle(a,b,m);triangle(m,b,c);}
          return;
        }
        for(const p of [a,b,c]){
          vertex.fromArray(p).applyMatrix4(matrix);
          vertex.y+=height({x:vertex.x+300,y:vertex.z+225});
          vertex.applyMatrix4(inverse);
          vertices.push(vertex.x,vertex.y,vertex.z);texels.push(p[3],p[4]);
        }
      }
      for(let i=0;i<pos.count;i+=3)triangle(read(i),read(i+1),read(i+2));
      const geo=new T.BufferGeometry();
      geo.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
      geo.setAttribute("uv",new T.Float32BufferAttribute(texels,2));
      geo.computeVertexNormals();object.geometry=geo;
      if(source!==old)source.dispose();
      if(!object.userData.sharedTerrainGeometry)old.dispose();
    }else{
      const {x,z}=object.position;
      object.position.y+=height({x:x+300,y:z+225});
    }
    if(++count%70===0)yield;
  }
}
