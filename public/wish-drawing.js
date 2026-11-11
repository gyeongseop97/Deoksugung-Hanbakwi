import {encodeWishFace,WISH_COLORS,WISH_HEIGHT,WISH_WIDTH} from "./wish-art.js";

const colorNames=["","먹색","빨강","주황","초록","파랑","보라","크림색"];
const faceNames=["앞면","오른쪽 면","뒷면","왼쪽 면"];

export function makeWishDrawing(onLaunch){
  const dialog=document.getElementById("wish-drawing");
  const canvas=dialog.querySelector("#wish-canvas");
  const context=canvas.getContext("2d");
  const panel=dialog.querySelector("#wish-panel");
  const tabs=[...dialog.querySelectorAll("[data-wish-face]")];
  const thumbnails=tabs.map(tab=>tab.querySelector("canvas").getContext("2d"));
  const palette=dialog.querySelector(".wish-palette");
  const eraser=dialog.querySelector("#wish-eraser");
  const clear=dialog.querySelector("#wish-clear");
  const faces=tabs.map(()=>new Uint8Array(WISH_WIDTH*WISH_HEIGHT));
  let active=0,ink=1,erasing=false,stroke=null;

  const swatches=WISH_COLORS.slice(1).map((color,index)=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="wish-swatch";
    button.style.setProperty("--swatch",color);
    button.setAttribute("aria-label",colorNames[index+1]);
    button.title=colorNames[index+1];
    button.addEventListener("click",()=>{ink=index+1;erasing=false;updateTools();});
    palette.append(button);
    return button;
  });

  function updateTools(){
    swatches.forEach((button,index)=>button.setAttribute("aria-pressed",String(!erasing&&ink===index+1)));
    eraser.setAttribute("aria-pressed",String(erasing));
    clear.disabled=!faces[active].some(Boolean);
  }

  function paint(target,pixels){
    target.clearRect(0,0,WISH_WIDTH,WISH_HEIGHT);
    for(let i=0;i<pixels.length;i++){
      if(!pixels[i])continue;
      target.fillStyle=WISH_COLORS[pixels[i]];
      target.fillRect(i%WISH_WIDTH,Math.floor(i/WISH_WIDTH),1,1);
    }
  }
  function repaint(){
    paint(context,faces[active]);
    paint(thumbnails[active],faces[active]);
    clear.disabled=!faces[active].some(Boolean);
  }
  function selectFace(index,focus=false){
    active=index;
    stroke=null;
    tabs.forEach((tab,i)=>{
      tab.setAttribute("aria-selected",String(i===index));
      tab.tabIndex=i===index?0:-1;
    });
    panel.setAttribute("aria-labelledby",tabs[index].id);
    canvas.setAttribute("aria-label","소원등 "+faceNames[index]+" 그림판");
    repaint();
    if(focus)tabs[index].focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>selectFace(index));
    tab.addEventListener("keydown",event=>{
      const next={
        ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,
        Home:0,End:tabs.length-1
      }[event.key];
      if(next===undefined)return;
      event.preventDefault();
      selectFace(next,true);
    });
  });
  eraser.addEventListener("click",()=>{erasing=!erasing;updateTools();});
  clear.addEventListener("click",()=>{faces[active].fill(0);repaint();});

  function point(event){
    const rect=canvas.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)*WISH_WIDTH/rect.width);
    const y=Math.floor((event.clientY-rect.top)*WISH_HEIGHT/rect.height);
    return x>=0&&x<WISH_WIDTH&&y>=0&&y<WISH_HEIGHT?{x,y}:null;
  }
  function stamp(x,y){
    if(!erasing){faces[active][y*WISH_WIDTH+x]=ink;return;}
    for(let row=Math.max(0,y-1);row<=Math.min(WISH_HEIGHT-1,y+1);row++){
      for(let col=Math.max(0,x-1);col<=Math.min(WISH_WIDTH-1,x+1);col++){
        faces[active][row*WISH_WIDTH+col]=0;
      }
    }
  }
  function draw(event){
    const end=point(event),start=stroke.previous??end;
    stroke.previous=end;
    if(!end)return;
    const dx=end.x-start.x,dy=end.y-start.y,steps=Math.max(1,Math.abs(dx),Math.abs(dy));
    for(let i=0;i<=steps;i++)stamp(Math.round(start.x+dx*i/steps),Math.round(start.y+dy*i/steps));
  }
  canvas.addEventListener("pointerdown",event=>{
    if(stroke||event.button!==0)return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    stroke={id:event.pointerId,previous:null};
    draw(event);
    repaint();
  });
  canvas.addEventListener("pointermove",event=>{
    if(stroke?.id!==event.pointerId)return;
    const events=event.getCoalescedEvents?.();
    if(events?.length)for(const sample of events)draw(sample);
    else draw(event);
    repaint();
  });
  canvas.addEventListener("pointerup",event=>{
    if(stroke?.id!==event.pointerId)return;
    draw(event);
    stroke=null;
    repaint();
  });
  for(const type of ["pointercancel","lostpointercapture"]){
    canvas.addEventListener(type,event=>{if(stroke?.id===event.pointerId)stroke=null;});
  }

  function close(){
    if(dialog.open)dialog.close();
  }
  dialog.addEventListener("close",()=>{stroke=null;});
  dialog.querySelector("#wish-back").addEventListener("click",close);
  dialog.querySelector("#wish-dismiss").addEventListener("click",close);
  dialog.querySelector("#wish-launch").addEventListener("click",()=>{
    const art=faces.map(encodeWishFace);
    if(onLaunch(art.some(Boolean)?art:null)===false)return;
    faces.forEach(face=>face.fill(0));
    thumbnails.forEach(target=>target.clearRect(0,0,WISH_WIDTH,WISH_HEIGHT));
    ink=1;erasing=false;
    selectFace(0);
    updateTools();
    close();
  });
  updateTools();
  return {
    open(){
      if(dialog.open)return;
      selectFace(active);
      dialog.showModal();
      tabs[active].focus();
    },
    close
  };
}
