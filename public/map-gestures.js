const slop=7,tapMs=420;
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const gap=(a,b)=>Math.max(12,Math.hypot(a.x-b.x,a.y-b.y));

export function bindMapGestures(surface,{getView,setView,onTap}){
  const contacts=new Map();
  let touchEnded=-Infinity;
  const point=event=>({x:event.clientX,y:event.clientY});
  function projected({x,y}){
    const matrix=surface.getScreenCTM();
    return matrix?new DOMPoint(x,y).matrixTransform(matrix.inverse()):null;
  }
  function zoom({view,base},scale,start,end=start){
    const ratio=Math.max(base.w*.23/view.w,Math.min(base.w*1.30/view.w,scale));
    setView({x:start.x-(end.x-view.x)*ratio,y:start.y-(end.y-view.y)*ratio,w:view.w*ratio,h:view.h*ratio});
  }
  surface.addEventListener("wheel",event=>{
    const state=getView(),delta=event.deltaY;
    if(!state||!Number.isFinite(delta)||!delta||event.ctrlKey||event.metaKey||contacts.size)return;
    const anchor=projected(point(event));
    if(!anchor)return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?surface.clientHeight:1;
    const amount=Math.max(-.65,Math.min(.65,delta*unit*.0025));
    zoom(state,Math.exp(amount),anchor);
  },{passive:false});
  surface.addEventListener("pointerdown",event=>{
    if(event.pointerType!=="touch"||event.button!==0)return;
    event.preventDefault();
    if(contacts.size>=2)return;
    const start=point(event);
    contacts.set(event.pointerId,{start,current:start,at:event.timeStamp,target:event.target,drag:false,pinch:false});
    if(contacts.size===2)for(const contact of contacts.values())contact.pinch=true;
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove",event=>{
    const contact=contacts.get(event.pointerId),state=getView();
    if(!contact||!state)return;
    const before=contact.current,after=point(event);
    contact.current=after;
    const {view}=state;
    if(contacts.size===2){
      const other=[...contacts.values()].find(value=>value!==contact).current;
      const start=projected(midpoint(before,other)),end=projected(midpoint(after,other));
      if(!start||!end)return;
      zoom(state,gap(before,other)/gap(after,other),start,end);
      return;
    }
    if(contact.pinch)return;
    if(!contact.drag&&Math.hypot(after.x-contact.start.x,after.y-contact.start.y)<slop)return;
    const start=projected(contact.drag?before:contact.start),end=projected(after);
    contact.drag=true;
    if(start&&end)setView({...view,x:view.x+start.x-end.x,y:view.y+start.y-end.y});
  });
  function finish(event,activate){
    const contact=contacts.get(event.pointerId);
    if(contact||event.pointerType==="touch")touchEnded=event.timeStamp;
    if(!contact)return;
    contacts.delete(event.pointerId);
    if(activate&&!contact.drag&&!contact.pinch&&event.timeStamp-contact.at<tapMs&&
      Math.hypot(event.clientX-contact.start.x,event.clientY-contact.start.y)<slop)onTap(event,contact.target);
  }
  surface.addEventListener("pointerup",event=>finish(event,true));
  for(const name of ["pointercancel","lostpointercapture"])surface.addEventListener(name,event=>finish(event,false));
  surface.addEventListener("click",event=>{
    const touch=event.pointerType==="touch"||event.sourceCapabilities?.firesTouchEvents;
    const legacyTouch=!event.pointerType&&event.sourceCapabilities?.firesTouchEvents!==false&&event.detail>0&&
      (contacts.size>0||event.timeStamp-touchEnded<700);
    if(event.isTrusted&&(touch||legacyTouch)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  return function clearMapGestures(){
    if(!contacts.size)return;
    const ids=[...contacts.keys()];contacts.clear();touchEnded=performance.now();
    for(const id of ids)if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
  };
}
