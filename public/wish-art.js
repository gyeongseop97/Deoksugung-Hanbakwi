export const WISH_WIDTH=40;
export const WISH_HEIGHT=56;
export const WISH_FLIGHT_MS=21000;
export const WISH_COLORS=[null,"#372321","#bd3b35","#a35428","#486347","#21657e","#77447b","#fff5dd"];

const faceSize=WISH_WIDTH*WISH_HEIGHT;
const packedSize=faceSize*3/8;
const base64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const encode=bytes=>btoa(String.fromCharCode(...bytes));

export function encodeWishFace(pixels){
  if(!pixels.some(Boolean))return "";
  const runs=[];
  for(let i=0;i<faceSize;){
    const color=pixels[i];
    let length=1;
    while(length<32&&pixels[i+length]===color)length++;
    runs.push((length-1)*8+color);
    i+=length;
  }
  if(runs.length<packedSize)return "r"+encode(runs);

  // Use three bits per pixel when runs would take more space.
  const packed=new Uint8Array(packedSize);
  for(let i=0;i<faceSize;i++){
    const bit=i*3,byte=bit>>3,shift=bit&7;
    packed[byte]|=pixels[i]<<shift;
    if(shift>5)packed[byte+1]|=pixels[i]>>(8-shift);
  }
  return "p"+encode(packed);
}

function readWishFace(face,pixels){
  if(typeof face!=="string"||face.length<5||face.length>1+Math.ceil(packedSize/3)*4)return false;
  const kind=face[0],data=face.slice(1);
  if((kind!=="r"&&kind!=="p")||!base64.test(data))return false;
  const bytes=atob(data);
  if(kind==="p"){
    if(bytes.length!==packedSize)return false;
    if(pixels)for(let i=0;i<faceSize;i++){
      const bit=i*3,byte=bit>>3,shift=bit&7;
      const next=shift>5?bytes.charCodeAt(byte+1)<<8:0;
      pixels[i]=((bytes.charCodeAt(byte)|next)>>shift)&7;
    }
    return true;
  }
  let index=0;
  for(let i=0;i<bytes.length;i++){
    const run=bytes.charCodeAt(i),length=(run>>3)+1;
    if(index+length>faceSize)return false;
    if(pixels)pixels.fill(run&7,index,index+length);
    index+=length;
  }
  return index===faceSize;
}

export function decodeWishFace(face){
  if(!face)return null;
  const pixels=new Uint8Array(faceSize);
  return readWishFace(face,pixels)?pixels:null;
}

export function validWishArt(faces){
  return Array.isArray(faces)&&faces.length===4&&Array.from(faces).every(face=>face===""||readWishFace(face));
}
