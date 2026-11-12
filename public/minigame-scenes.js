const width=640,height=292;
const mix=(a,b,t)=>a+(b-a)*t;
const unit=n=>Math.max(0,Math.min(1,n));

function polygon(ctx,points,color){
  ctx.fillStyle=color;ctx.beginPath();
  points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();ctx.fill();
}
function ellipse(ctx,x,y,rx,ry,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}
function line(ctx,x,y,xx,yy,color,weight=1){
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();
}
function autumn(ctx,x,y,side){
  ctx.save();ctx.translate(x,y);ctx.scale(side,1);
  line(ctx,0,14,8,-86,"#694e36",6);line(ctx,6,-43,35,-72,"#694e36",3);
  for(const [dx,dy,r,color] of [[-16,-66,24,"#b87f42"],[11,-86,28,"#ce9848"],[32,-70,24,"#dfa950"],
    [-12,-96,19,"#c28043"],[48,-91,18,"#da9850"],[17,-61,19,"#c87938"],[33,-108,17,"#e1b760"]])ellipse(ctx,dx,dy,r,r*.66,color);
  ctx.restore();
}
function background(ctx,kite){
  const sky=ctx.createLinearGradient(0,0,0,185);
  sky.addColorStop(0,"#80a8b3");sky.addColorStop(1,"#e1d8b0");ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  for(const [x,y] of [[125,48],[503,38]]){
    ellipse(ctx,x,y,43,8,"#f3edce");ellipse(ctx,x-10,y-4,18,10,"#f3edce");ellipse(ctx,x+17,y-2,21,9,"#f3edce");
  }
  polygon(ctx,[[0,120],[44,106],[100,108],[151,80],[202,101],[258,114],[316,98],[367,108],[418,88],[480,105],[544,83],[640,112],[640,167],[0,167]],"#79908a");
  if(kite){
    for(const [x,w,h] of [[20,39,43],[74,47,61],[134,28,28],[495,52,49],[553,42,76],[608,32,42]]){
      ctx.fillStyle="#7a8d89";ctx.fillRect(x,156-h,w,h);
      for(let y=160-h;y<147;y+=8)line(ctx,x+6,y,x+w-6,y,"#8d9e94",1);
    }
  }else{
    ctx.fillStyle="#be9a6f";ctx.fillRect(0,132,640,36);
    ctx.fillStyle="#8a4b3b";ctx.fillRect(243,122,153,43);
    for(const x of [251,280,319,359,388]){ctx.fillStyle="#ad5d44";ctx.fillRect(x-3,117,6,49);}
    polygon(ctx,[[209,123],[238,110],[256,96],[379,96],[402,111],[430,122],[420,130],[221,130]],"#3c5250");
    line(ctx,223,125,415,125,"#6e9c89",3);
    polygon(ctx,[[246,101],[262,90],[374,90],[393,102]],"#42534e");
  }
  const floor=ctx.createLinearGradient(0,152,0,height);
  floor.addColorStop(0,kite?"#a1a16d":"#c1a885");floor.addColorStop(1,kite?"#627e55":"#9e8b6e");
  ctx.fillStyle=floor;ctx.fillRect(0,163,width,height-163);
  for(const y of [170,187,210,244])line(ctx,0,y,width,y,kite?"#7e925d":"#a18c6c");
  for(const x of [0,120,240,400,520,640])line(ctx,320+(x-320)*.58,163,x,height,kite?"#809264":"#ad9675");
  autumn(ctx,41,168,1);autumn(ctx,591,168,-1);
}

function arrow(ctx,x,y,angle,color){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  line(ctx,0,-19,0,15,color,3);
  polygon(ctx,[[0,-26],[-5,-16],[5,-16]],"#ddd2ac");
  polygon(ctx,[[0,9],[-7,17],[-7,23],[0,19],[7,23],[7,17]],"#a33d36");
  ctx.restore();
}
function tuho(ctx,frame,shot,time){
  ellipse(ctx,320,221,70,10,"#74684f52");
  polygon(ctx,[[281,165],[291,213],[303,219],[337,219],[349,213],[359,165]],"#98593c");
  ellipse(ctx,320,165,39,11,"#d9a568");ellipse(ctx,320,165,32,7,"#382d28");
  for(const y of [179,197,210])line(ctx,292,y,348,y,"#c88d55",2);
  if(!shot||time-shot.at>960){arrow(ctx,438+Math.sin((frame?.progress??0)*Math.PI)*25,204,.54,"#674936");return;}
  const t=unit((time-shot.at)/470),goal=shot.points?320:410;
  const x=mix(438,goal,t),y=mix(204,shot.points?160:202,t)-100*Math.sin(t*Math.PI);
  arrow(ctx,x,y,mix(.54,Math.PI*.86,t),shot.points?"#f1d98a":"#a6674e");
}
function jegi(ctx,game,frame,shot,time){
  const knee=shot&&time-shot.at<330?Math.sin(unit((time-shot.at)/330)*Math.PI):0;
  ellipse(ctx,267,225,61,10,"#74684f55");
  ellipse(ctx,247,124,25,28,"#503d31");ellipse(ctx,256,130,23,24,"#e2ad7a");
  ellipse(ctx,248,109,23,11,"#4d3a30");
  polygon(ctx,[[234,151],[267,150],[282,191],[223,191]],"#477b75");
  line(ctx,232,154,219,178,"#c6dbb7",9);line(ctx,269,154,288,175,"#c6dbb7",9);
  line(ctx,244,190,235,220,"#304f53",12);line(ctx,268,189,298+knee*20,221-knee*40,"#304f53",12);
  line(ctx,235,222,249,222,"#4f3f32",8);line(ctx,298+knee*20,221-knee*40,309+knee*20,219-knee*40,"#4f3f32",8);
  const phase=unit((frame?.at??0)/game.targetMs),kick=shot&&shot.points&&time-shot.at<540?Math.sin(unit((time-shot.at)/540)*Math.PI):0;
  const x=335+kick*34,y=208-Math.sin(Math.PI*phase)*108-kick*83;
  ellipse(ctx,x,y+8,7,4,"#42392e");
  for(const [i,color] of ["#db7956","#ead184","#467d75","#f1e2a6","#c47b55"].entries())line(ctx,x,y+5,x+(i-2)*3,y-8-i%2*3,color,2);
}
function kite(ctx,frame,shot,time){
  const progress=frame?.progress??0,wind=frame?.move??1,drag=shot&&time-shot.at<650?shot.move*22*(1-unit((time-shot.at)/650)):0;
  const x=320+wind*62*Math.sin(progress*Math.PI)+drag,y=93-Math.sin(progress*2*Math.PI)*10;
  ctx.strokeStyle="#f2e2ac";ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(324,238);ctx.quadraticCurveTo(x-90,170,x,y+28);ctx.stroke();
  polygon(ctx,[[x,y-33],[x+46,y-5],[x,y+33],[x-46,y-5]],"#e6b36c");
  polygon(ctx,[[x,y-29],[x+41,y-5],[x,y+27],[x-41,y-5]],"#c27155");
  line(ctx,x,y-27,x,y+27,"#edd6aa",2);line(ctx,x-41,y-5,x+41,y-5,"#edd6aa",2);
  ellipse(ctx,x,y-4,11,9,"#608e8a");ellipse(ctx,x+1,y-5,4,4,"#e8c97d");
  for(let i=0;i<4;i++){
    const dx=x+Math.sin(i+progress*5)*13,dy=y+38+i*8;
    line(ctx,dx-5,dy,dx+5,dy+4,i%2?"#deab68":"#bf6f4f",3);
  }
  const arrowX=x+wind*101;
  line(ctx,arrowX-wind*24,y+2,arrowX+wind*13,y+2,"#fff0bf",4);
  polygon(ctx,[[arrowX+wind*21,y+2],[arrowX+wind*10,y-6],[arrowX+wind*10,y+10]],"#fff0bf");
}

export function makeMinigameScene(canvas){
  const backdrop=document.createElement("canvas");canvas.width=backdrop.width=width;canvas.height=backdrop.height=height;
  const ctx=canvas.getContext("2d"),backdropContext=backdrop.getContext("2d");
  let sceneId;
  return (game,frame,shot,time)=>{
    if(!ctx||!backdropContext)return;
    if(sceneId!==game.id){sceneId=game.id;background(backdropContext,game.id==="kite");}
    ctx.drawImage(backdrop,0,0);
    if(game.id==="tuho")tuho(ctx,frame,shot,time);
    else if(game.id==="jegi")jegi(ctx,game,frame,shot,time);
    else kite(ctx,frame,shot,time);
    const x=146,y=260,w=348;
    line(ctx,x,y,x+w,y,"#253429a8",10);
    const target=x+w*game.targetMs/game.beatMs,good=w*game.good/game.beatMs,perfect=w*game.perfect/game.beatMs;
    line(ctx,target-good,y,target+good,y,"#c6a366",10);
    line(ctx,target-perfect,y,target+perfect,y,"#f8db91",10);
    if(frame){
      const pointer=x+frame.progress*w;
      line(ctx,pointer,y-8,pointer,y+8,"#fff9e4",3);
    }
  };
}
