import {gradePalaceMeshes} from "./gyeongbok-terrain.js";

export function* gradeJeongdongMeshes(T,root,terrain,{trees=[],catWalls=[]}={}){
  function* grade(objects){
    const ordinary=[];
    for(const object of objects){
      const {gradeChildren,terrainAnchor,terrainWallSpan,flatBackground}=object.userData;
      if(gradeChildren){
        yield* grade(object.children);
      }else if(terrainAnchor){
        object.position.y+=terrain(terrainAnchor);
      }else if(terrainWallSpan){
        const {a,b,length}=terrainWallSpan;
        const start=terrain(a),end=terrain(b);
        object.position.y+=(start+end)/2;
        object.updateMatrix();
        // Only the wall's horizontal span rises. Posts and masonry stay vertical.
        object.matrix.elements[1]=(end-start)/length;
        object.matrixAutoUpdate=false;
      }else if(flatBackground){
        object.position.y=-8;
      }else ordinary.push(object);
    }
    yield* gradePalaceMeshes(T,ordinary,terrain);
  }
  yield* grade(root.children);
  for(const tree of trees)if(tree.top)tree.top.y+=terrain({x:tree.x+300,y:tree.z+225});
  for(const wall of catWalls)wall.groundAt=terrain;
  const material=new T.MeshStandardMaterial({color:0x777650,roughness:1});
  material.userData.seasonFoliage="ground";
  const patch=64,edge=485;
  for(let top=-12;top<451;top+=patch){
    for(let left=-47;left<edge;left+=patch){
      const width=Math.min(patch,edge-left);
      const geometry=new T.PlaneGeometry(width,patch);
      geometry.rotateX(-Math.PI/2);
      const tile=new T.Mesh(geometry,material);tile.receiveShadow=true;
      tile.position.set(left+width/2-300,-.20,top+patch/2-225);
      tile.userData.followTerrain=true;
      yield* gradePalaceMeshes(T,[tile],terrain);
      root.add(tile);
    }
    yield;
  }
}
