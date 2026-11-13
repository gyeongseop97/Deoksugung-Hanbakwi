// Vertex-colour scans of these halls contain distorted porches and windows.
// Keep the measured roofs and build walkable surfaces and joinery in the game.
const roofCutoff={junghwajeon:7.72,hamnyeongjeon:4.98,seogeodang:4.08};
// The pavilion's stair and railing scans are intact above the base.
const groundCutoff={jeonggwanheon:-.08};

export function prepareSurveyTerrain(T,asset,name,models){
  const minHeight=roofCutoff[name]??groundCutoff[name];
  if(minHeight==null)return models;
  const replaced=roofCutoff[name]!=null?models.flatMap(model=>model.userData.surveyRoofs??[]):models;
  if(!replaced.length)throw Error("Missing modeled survey components");

  asset.updateMatrixWorld(true);
  const position=new T.Vector3(),inverse=asset.matrixWorld.clone().invert(),matrix=new T.Matrix4();
  let retained=0;
  asset.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry,index=geometry.index,vertices=geometry.getAttribute("position");
    const heights=new Float32Array(vertices.count);
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    for(let vertex=0;vertex<vertices.count;vertex++){
      heights[vertex]=position.fromBufferAttribute(vertices,vertex).applyMatrix4(matrix).y;
    }
    const triangles=[];
    for(let face=0,count=index?.count??vertices.count;face<count;face+=3){
      const a=index?.getX(face)??face,b=index?.getX(face+1)??face+1,c=index?.getX(face+2)??face+2;
      if(Math.min(heights[a],heights[b],heights[c])>=minHeight)triangles.push(a,b,c);
    }
    geometry.setIndex(triangles);
    retained+=triangles.length;
  });
  if(!retained)throw Error("Missing survey geometry above the floor");
  return replaced;
}
