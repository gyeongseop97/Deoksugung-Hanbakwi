export function drawPassportStamp(canvas,motif,ink){
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  canvas.width=144;canvas.height=144;ctx.scale(1.5,1.5);
  ctx.strokeStyle=ctx.fillStyle=ink;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=2.8;
  const line=(...points)=>{ctx.beginPath();ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.stroke();};
  const arc=(x,y,r,a=0,b=Math.PI*2)=>{ctx.beginPath();ctx.arc(x,y,r,a,b);ctx.stroke();};
  const rect=(x,y,w,h)=>ctx.strokeRect(x,y,w,h);
  const roof=(x,y,w)=>line([x,y],[x+w*.24,y-5],[x+w*.42,y-14],[x+w*.58,y-14],[x+w*.76,y-5],[x+w,y]);
  const waves=(y,left=25,width=46)=>{
    ctx.beginPath();ctx.moveTo(left,y);
    for(let i=0;i<3;i++)ctx.quadraticCurveTo(left+width*(i+.5)/3,y+(i%2?7:-7),left+width*(i+1)/3,y);
    ctx.stroke();
  };
  ctx.lineWidth=1.4;arc(48,48,43.5);ctx.setLineDash([1.1,3.7]);arc(48,48,39.6);ctx.setLineDash([]);ctx.lineWidth=2.8;
  switch(motif){
    case "gate":
      roof(19,40,58);roof(26,31,44);line([24,44],[72,44]);rect(26,47,44,21);
      for(const x of [34,48,62]){arc(x,60,4.8,Math.PI,0);line([x-4.8,60],[x-4.8,67]);line([x+4.8,60],[x+4.8,67]);}
      break;
    case "hall":
      roof(19,39,58);roof(28,31,40);line([24,43],[72,43]);line([22,67],[74,67]);
      for(const x of [28,37,48,59,68])line([x,46],[x,64]);line([20,73],[76,73]);break;
    case "pavilion":
      roof(18,41,60);line([24,45],[72,45]);line([23,61],[73,61]);
      for(const x of [28,40,56,68])line([x,46],[x,61]);line([28,64],[28,70]);line([68,64],[68,70]);
      waves(74,21,54);break;
    case "columns":
      line([20,39],[48,24],[76,39],[20,39]);line([24,44],[72,44]);
      for(const x of [29,39,49,59,69])line([x,47],[x,64]);
      line([24,66],[72,66]);line([20,72],[76,72]);break;
    case "tower":
      rect(28,43,40,27);line([25,43],[35,30],[58,30],[70,43],[25,43]);
      line([35,30],[39,21],[44,30]);rect(43,54,10,16);for(const x of [34,60])rect(x,50,5,8);break;
    case "bridge":
      line([20,44],[33,37],[64,37],[76,44]);line([22,49],[74,49]);
      for(const x of [36,60])arc(x,59,9,Math.PI,0);waves(68,22,52);break;
    case "sword":
      line([27,68],[63,31],[71,24],[69,35],[36,72]);line([27,55],[43,71]);arc(58,50,13,-.5,1.1);break;
    case "book":
      line([48,38],[35,29],[23,31],[23,60],[37,57],[48,64],[59,57],[73,60],[73,31],[60,29],[48,38],[48,64]);
      line([30,39],[40,41]);line([30,47],[40,49]);line([56,41],[66,39]);line([56,49],[66,47]);break;
    case "ruin":
      rect(24,58,18,9);rect(42,58,20,9);rect(62,58,10,9);rect(32,47,18,10);rect(50,47,16,10);
      rect(37,36,18,10);line([26,69],[73,69]);break;
    case "hills":
      line([21,62],[39,40],[48,48],[60,32],[75,62]);arc(29,34,6);waves(67,20,55);break;
    case "pond":
      roof(35,39,26);line([38,43],[58,43]);line([40,44],[40,53]);line([56,44],[56,53]);
      line([37,54],[60,54]);waves(61,19,59);waves(71,26,44);break;
    case "leaf":
      line([48,72],[49,60],[34,59],[23,49],[38,47],[28,35],[43,39],[49,23],[55,39],[68,32],[59,47],[74,49],[61,59],[49,60]);break;
    case "fan":
      arc(48,70,44,-2.42,-.72);arc(48,70,15,-2.42,-.72);
      for(let i=-3;i<=3;i++)line([48,70],[48+Math.sin(i*.28)*44,70-Math.cos(i*.28)*44]);break;
    case "crown":
      line([23,43],[31,64],[65,64],[73,43],[60,53],[48,29],[36,53],[23,43]);
      line([31,70],[65,70]);arc(48,51,3.6);break;
    case "flower":
      arc(48,48,6);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;arc(48+Math.sin(a)*13,48+Math.cos(a)*13,8);}
      line([49,65],[47,73]);break;
    default:
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(48,57);ctx.quadraticCurveTo(48+side*13,21,48+side*24,49);ctx.stroke();
        ctx.beginPath();ctx.moveTo(48,55);ctx.quadraticCurveTo(48+side*7,26,48+side*11,39);ctx.stroke();
      }
      waves(64,22,52);waves(72,29,38);
  }
}
