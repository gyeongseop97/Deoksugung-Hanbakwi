import {ITEMS, PET_MS} from "./activities.js";

const TAU = Math.PI * 2;
const HAIR = ["short", "bob", "long", "bun"];
const EYES = ["round", "soft", "bright"];
const OUTFITS = ["coat", "puffer", "tee", "hanbok"];
const SIDE = [-1, 1];
const LEG = [.322, .304];
const ARM = [.252, .228];
const SOLE = .124;
const FACE_TONES = [
  {top:"#f8d1ad", middle:"#f4c59f", chin:"#e3a880", light:"#fff1d55d", cheek:"#e88e897a", radius:14},
  {top:"#f8c1aa", middle:"#f4b198", chin:"#e39b86", light:"#ffe2ce50", cheek:"#e57678a6", radius:18},
  {top:"#f8ae9e", middle:"#f09788", chin:"#df887b", light:"#ffd4c148", cheek:"#df636bc2", radius:22},
  {top:"#f69e96", middle:"#ef8078", chin:"#d76d68", light:"#ffc3b842", cheek:"#d54d59d2", radius:26}
];
const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const mix = (a, b, t) => a + (b - a) * t;

function canvasTexture(T, width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"));
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function oval(ctx, x, y, width, height, color, angle = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, angle, 0, TAU);
  ctx.fill();
}

function softTint(ctx, x, y, radius, color) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "#ffffff00");
  oval(ctx, x, y, radius, radius, glow);
}

function faceTexture(T, eyes, blink, blushLevel) {
  const colors = FACE_TONES[blushLevel];
  return canvasTexture(T, 512, 256, ctx => {
    const tone = ctx.createLinearGradient(0, 42, 0, 204);
    tone.addColorStop(0, colors.top);
    tone.addColorStop(.47, colors.middle);
    tone.addColorStop(1, colors.chin);
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, 512, 256);
    softTint(ctx, 128, 108, 49, colors.light);
    for (const side of SIDE) {
      const x = 128 + side * 27;
      softTint(ctx, 128 + side * 42, 148, colors.radius, colors.cheek);
      ctx.strokeStyle = "#52352b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 7, 114);
      ctx.quadraticCurveTo(x, eyes === "soft" ? 110 : 108, x + 7, 113);
      ctx.stroke();
      if (blink || eyes === "soft") {
        ctx.lineWidth = blink ? 2.6 : 3.5;
        ctx.beginPath();
        ctx.moveTo(x - 8, 129);
        ctx.quadraticCurveTo(x, blink ? 133 : 119, x + 8, 129);
        ctx.stroke();
      } else {
        if (eyes === "bright") oval(ctx, x, 128.5, 10.5, 12.4, "#fff5dd");
        const narrow = eyes === "bright" ? 7.1 : 7.9;
        oval(ctx, x, 128.3, narrow, 11.4, "#3d2a26", side * .09);
        oval(ctx, x + .7, 133, narrow * .66, 5.5, "#9c6549");
        oval(ctx, x - .1, 128.1, narrow * .72, 8.6, "#352526");
        oval(ctx, x - 2.4, 123.9, 2.75, 3.0, "#fff6e5");
        oval(ctx, x + 2.8, 132.1, 1.15, 1.3, "#f4c89b");
      }
      for (let spot = 0; spot < 3; spot++) {
        oval(ctx, 128 + side * (36 + spot * 4.6), 148 + (spot === 1 ? 2 : 0), .77, .65, "#a4554359");
      }
    }
    softTint(ctx, 128, 144, 10, "#c2795b79");
    oval(ctx, 127, 140.5, 3.9, 1.9, "#ffdcb7");
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = "#78463e";
    ctx.beginPath();
    ctx.moveTo(121, 155);
    ctx.quadraticCurveTo(128, 162, 135, 155);
    ctx.stroke();
  });
}

function garmentTexture(T, style) {
  return canvasTexture(T, 256, 256, ctx => {
    ctx.fillStyle = "#f3ece6";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 1; y < 256; y += 3) {
      ctx.fillStyle = y % 4 ? "#4535280a" : "#fffaf033";
      ctx.fillRect(0, y, 256, 1);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (style === "puffer") {
      ctx.fillStyle = "#5a504e8a"; ctx.fillRect(124,0,8,256);
      ctx.fillStyle = "#c9bcb8"; ctx.fillRect(127,0,2,256);
      for (const x of [103,153]) {
        ctx.strokeStyle = "#64575685"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x-5,168); ctx.lineTo(x+5,190); ctx.stroke();
      }
    } else if (style === "tee") {
      ctx.strokeStyle = "#70655f7e"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(128,-4,17,23,0,0,TAU); ctx.stroke();
      ctx.fillStyle = "#b4a8a15e";
      ctx.beginPath(); ctx.roundRect(145,76,16,24,2); ctx.fill();
    } else {
      ctx.fillStyle = "#82665d64";
      ctx.beginPath(); ctx.moveTo(143, 64); ctx.lineTo(111, 128); ctx.lineTo(114, 139); ctx.lineTo(153, 79); ctx.fill();
      ctx.strokeStyle = "#a891804d"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(104, 0); ctx.lineTo(143, 112); ctx.lineTo(119, 147); ctx.stroke();
      for (let y = 189; y < 242; y += 9) { ctx.fillStyle = "#9b776c26"; ctx.fillRect(0, y, 256, 2); }
    }
    ctx.strokeStyle = "#65564d65";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(-4, 224, 264, 21);
  });
}

function hairCap(T, style) {
  const geometry = new T.BufferGeometry();
  const positions = [], colors = [], triangles = [];
  const rings = 13, sides = 48;
  const base = new T.Color(style === "bun" ? 0x372b32 : 0x46312e);
  for (let row = 0; row <= rings; row++) {
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * TAU;
      const front = Math.cos(angle);
      const trim = {
        short:1.60-front*.62+Math.sin(angle)*.12,
        bob:1.78-front*.46+Math.cos(angle*12)*.026*Math.max(0,front),
        long:1.73-front*.84+Math.abs(Math.sin(angle))*.25*Math.max(0,front),
        bun:1.56-front*.82+Math.sin(angle)*.042
      }[style];
      const pitch = .009 + row / rings * trim;
      const wave = Math.sin(angle * 13 + pitch * 2) * .0034 * Math.sin(pitch);
      positions.push(Math.sin(angle) * Math.sin(pitch) * (.358 + wave),
        .016 + Math.cos(pitch) * (.350 + wave),
        -.019 + Math.cos(angle) * Math.sin(pitch) * (.351 + wave));
      const strand = style === "bob" ? Math.sin(angle*22+pitch*.9) : Math.sin(angle*13+pitch*2);
      const sheen = 1 + .11 * Math.sin(angle * 2 + .3) + .071 * strand
        + .22 * Math.max(0, 1 - Math.abs(pitch - .75) * 2) * Math.max(0, Math.cos(angle - .55));
      colors.push(base.r * sheen, base.g * sheen, base.b * sheen);
      if (row && side) {
        const a = (row - 1) * (sides + 1) + side - 1, b = a + sides + 1;
        triangles.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

function hairLock(T, points, width, depth, tint) {
  const path = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  const geometry = new T.TubeGeometry(path, 14, 1, 9, false);
  const position = geometry.attributes.position;
  const colors = [];
  const base = new T.Color(tint);
  for (let row = 0; row <= 14; row++) {
    const p = row / 14, center = path.getPointAt(p);
    const volume = .025 + .975 * Math.sin(Math.PI * p) ** .52;
    for (let side = 0; side <= 9; side++) {
      const i = row * 10 + side;
      position.setXYZ(i, center.x + (position.getX(i) - center.x) * width * volume,
        center.y + (position.getY(i) - center.y) * width * volume,
        center.z + (position.getZ(i) - center.z) * depth * volume);
      const shade = .91 + .19 * Math.max(0, Math.sin(p * Math.PI)) + .12 * Math.cos(side / 9 * TAU);
      colors.push(base.r * shade, base.g * shade, base.b * shade);
    }
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function combineParts(T, parts) {
  const geometry = new T.BufferGeometry();
  const positions = [], colors = [], normals = [], indices = [];
  let offset = 0;
  for (const part of parts) {
    const attributes = part.attributes;
    positions.push(...attributes.position.array);
    normals.push(...attributes.normal.array);
    colors.push(...attributes.color.array);
    for (const index of part.index.array) indices.push(index + offset);
    offset += attributes.position.count;
    part.dispose();
  }
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function styledHair(T, style) {
  const parts = [hairCap(T, style)];
  const lock = (points, width, depth, tint) => parts.push(hairLock(T, points, width, depth, tint));
  if (style === "short") {
    lock([[-.236,.226,.179],[-.178,.323,.204],[-.051,.360,.228],[.111,.312,.263],[.234,.175,.233]],
      .089,.065,0x4d3430);
    lock([[-.253,.195,.166],[-.168,.260,.249],[-.036,.235,.312],[.117,.181,.300]], .059,.035,0x553934);
    lock([[-.274,.148,.155],[-.216,.196,.247],[-.133,.155,.292]], .043,.027,0x412c2a);
  } else if (style === "long") {
    for (const side of SIDE) {
      lock([[side*.021,.321,.132],[side*.077,.291,.233],[side*.161,.222,.281],[side*.233,.136,.265],
        [side*.286,.024,.199]], .058,.035,side===1 ? 0x573932 : 0x4b322e);
    }
  } else if (style === "bun") {
    for (const side of SIDE) {
      lock([[side*.055,.319,.162],[side*.137,.329,.164],[side*.243,.252,.149],[side*.294,.131,.133]],
        .054,.041,0x4a3437);
    }
  }
  if (style === "bob" || style === "long") {
    const end = style === "long" ? -.565 : -.297;
    for (const side of SIDE) {
      lock([[side*.234,.151,-.135],[side*.286,.017,-.125],[side*.286,-.153,-.137],
        [side*.282,end*.79,-.130],[side*.23,end,-.117]], .111, .112, 0x49312f);
      lock([[side*.269,.146,.128],[side*.307,.016,.143],[side*.296,-.128,.122],
        [side*.264,end*.72,.079]], .069, .056, 0x503732);
    }
    lock([[0,.213,-.184],[.014,.02,-.238],[-.016,end*.60,-.221],[0,end,-.19]],
      style === "long" ? .26 : .244, .118, 0x442f30);
  } else if (style === "bun") {
    const bun = new T.SphereGeometry(1,24,16), points = bun.attributes.position;
    const colors = [], base = new T.Color(0x493439);
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
      const ridge = Math.sin(Math.atan2(z,x)*6+y*5.7)*(1-y*y);
      const volume = 1+ridge*.055;
      points.setXYZ(i,.032+x*.143*volume,.424+y*.129,-.101+z*.129*volume);
      const light = 1+.13*ridge+.14*y;
      colors.push(base.r*light,base.g*light,base.b*light);
    }
    bun.setAttribute("color",new T.Float32BufferAttribute(colors,3));
    bun.computeVertexNormals();
    parts.push(bun);
    lock([[-.114,.378,-.126],[-.051,.342,.003],[.057,.344,.024],[.157,.383,-.091]], .043,.037,0x614344);
  }
  return combineParts(T, parts);
}

function modeledDetails(T, sphere, specifications) {
  return combineParts(T,specifications.map(([color,x,y,z,sx,sy,sz,rotation=0]) => {
    const part = sphere.clone().scale(sx,sy,sz).rotateZ(rotation).translate(x,y,z);
    const tint = new T.Color(color), colors = new Float32Array(part.attributes.position.count*3);
    for (let i=0;i<colors.length;i+=3) {
      colors[i]=tint.r; colors[i+1]=tint.g; colors[i+2]=tint.b;
    }
    part.setAttribute("color",new T.BufferAttribute(colors,3));
    return part;
  }));
}

function roundedLathe(T, points, depth = 1, sides = 24) {
  const profile = points.map(([r,y]) => new T.Vector2(r,y));
  const geometry = new T.LatheGeometry(profile,sides);
  geometry.scale(1,1,depth);
  geometry.rotateY(Math.PI);
  return geometry;
}

function coatShell(T, profile, gap, depth) {
  const geometry = new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),36,gap,TAU-2*gap);
  geometry.scale(1,1,depth);
  return geometry;
}

function collarPanels(T, outlines) {
  const faces = outlines.map(outline=>new T.Shape(outline.map(([x,y])=>new T.Vector2(x,y))));
  return new T.ExtrudeGeometry(faces,{depth:.012,bevelThickness:.006,bevelSize:.006,bevelSegments:1,steps:1});
}

function chimaGeometry(T) {
  const geometry = roundedLathe(T,[[.320,-.812],[.334,-.825],[.355,-.805],[.374,-.748],[.356,-.570],
    [.318,-.343],[.268,-.132],[.229,-.028],[.224,0],[0,0]],.88,64);
  const points=geometry.attributes.position, colors=[];
  for (let i=0;i<points.count;i++) {
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i),angle=Math.atan2(x,z);
    const fold=Math.cos(angle*18+y*2), fullness=clamp(-y/.825);
    const scale=1+fold*(.014+fullness*.051);
    points.setXYZ(i,x*scale,y,z*scale);
    const light=1+fold*(.028+fullness*.075);
    colors.push(light,light,light);
  }
  geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function makeWalkerModels(T, scene, {wx, wz}, createItemProp) {
  const sphere = new T.SphereGeometry(1,16,12);
  const head = new T.SphereGeometry(1,28,22);
  const shadowGeometry = new T.CircleGeometry(.42,20);
  const segment = roundedLathe(T, [[0,-1.125],[.49,-1.109],[.72,-1.068],[.86,-.994],
    [.92,-.67],[1,-.28],[.99,-.035],[.87,.048],[.56,.111],[0,.14]],1,12);
  const paddedSleeve = roundedLathe(T,[[0,-1.12],[.53,-1.075],[.91,-1],[1,-.82],[.84,-.65],
    [1.04,-.48],[.85,-.26],[1.05,-.12],[.89,.047],[.47,.11],[0,.14]],1,14);
  const shortSleeve = roundedLathe(T,[[.77,-.78],[1.02,-.78],[1.05,-.66],[1.11,-.38],
    [1.10,-.08],[.86,.057],[.41,.122],[0,.132]],1,14);
  const coatTop = coatShell(T,[[.275,-.109],[.286,-.085],[.278,.10],[.288,.277],
    [.295,.369],[.263,.437],[.181,.487],[.144,.489]],.33,.82);
  const coatTail = coatShell(T,[[.323,-.378],[.338,-.347],[.320,-.235],
    [.299,-.108],[.278,.007],[.272,.055]],.69,.93);
  const lapelPoints = [[.063,.465],[.187,.409],[.157,.299],[.112,.321],[.116,.231],[.051,.335]];
  const lapelGeometry = collarPanels(T,SIDE.map(side=>lapelPoints.map(([x,y])=>[x*side,y])));
  const jeogoriCollar = collarPanels(T,[
    [[-.121,.461],[-.087,.473],[.069,.325],[.047,.301]],
    [[.114,.473],[.142,.455],[.069,.325],[.047,.301]]
  ]);
  const skirtGeometry = chimaGeometry(T);
  const torsoGeometry = {
    coat: roundedLathe(T,[[0,-.128],[.202,-.128],[.225,-.079],[.224,.160],[.237,.355],
      [.227,.42],[.155,.475],[.121,.48],[0,.48]],.74),
    puffer: roundedLathe(T,[[0,-.126],[.217,-.126],[.268,-.113],[.273,-.096],[.264,-.078],
      [.289,-.058],[.299,-.015],[.288,.036],[.270,.052],[.292,.072],[.305,.113],
      [.291,.162],[.269,.174],[.297,.202],[.305,.247],[.289,.285],[.265,.302],
      [.290,.327],[.295,.365],[.275,.402],[.246,.421],[.201,.466],[.142,.479],[0,.479]],.82,32),
    tee: roundedLathe(T,[[0,-.104],[.201,-.104],[.229,-.097],[.241,-.077],[.244,.113],
      [.249,.265],[.255,.369],[.225,.431],[.167,.471],[.120,.476],[0,.476]],.71),
    hanbok: roundedLathe(T,[[0,-.021],[.234,-.021],[.255,-.009],[.256,.035],[.246,.20],
      [.254,.32],[.262,.385],[.235,.443],[.163,.475],[.126,.476],[0,.476]],.75)
  };
  const hairGeometry = Object.fromEntries(HAIR.map(style => [style,styledHair(T,style)]));
  const hairMaterial = new T.MeshStandardMaterial({vertexColors:true,roughness:.79,side:T.DoubleSide});
  const textileStyles = OUTFITS.filter(style=>style!=="coat");
  const garmentMaps = Object.fromEntries(textileStyles.map(style => [style,garmentTexture(T,style)]));
  const faces = new Map(), clothes = new Map();
  const matte = (color, roughness = .84) => new T.MeshStandardMaterial({color,roughness});
  const skin = matte(0xf0bc99), details = new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
  const earMaterials = [0xffffff,0xffe0ee,0xffc4d9,0xffa6c5].map(color =>
    new T.MeshStandardMaterial({color,vertexColors:true,roughness:.86}));
  const pants = matte(0x514e57), hanbokPants = matte(0xa0997f);
  const ivory = matte(0xf0debd), hairpin = matte(0xdfb475);
  const earGeometry = modeledDetails(T,sphere,SIDE.flatMap(side => [
    [0xf0bc99,side*.309,-.026,.001,.062,.083,.050], [0xd8947e,side*.340,-.024,.034,.024,.046,.017]
  ]));
  const footGeometry = modeledDetails(T,sphere,[
    [0xcdbda2,0,-.098,.044,.106,.026,.171],[0x463836,0,-.057,.041,.105,.057,.167],
    [0xddc9a9,0,-.011,.087,.066,.010,.020]
  ]);
  const handGeometry = SIDE.map(side => modeledDetails(T,sphere,[
    [0xf2bd98,0,-.035,.012,.067,.073,.052],[0xf2bd98,-side*.043,-.028,.035,.028,.040,.029]
  ]));
  const knotGeometry = modeledDetails(T,sphere,[
    [0xc97c66,0,0,0,.048,.036,.027],[0xc97c66,-.045,-.017,.007,.062,.023,.016,-.36],
    [0xc97c66,.048,.008,.004,.056,.023,.016,.26],[0xc97c66,.042,-.075,.011,.020,.072,.012,.27],
    [0xf0debd,.073,-.062,.007,.017,.059,.011,.53]
  ]);
  const buttonsGeometry = modeledDetails(T,sphere,[
    [0xc1a184,.095,.10,.217,.016,.016,.011],[0xc1a184,.095,.198,.214,.016,.016,.011],
    [0xc1a184,.095,.285,.213,.016,.016,.011]
  ]);

  function faceMaterial(eye, blink, blush) {
    const key = `${eye}/${blink}/${blush}`;
    if (!faces.has(key)) faces.set(key, new T.MeshStandardMaterial({
      color:0xffffff, map:faceTexture(T,eye,blink,blush), roughness:.84
    }));
    return faces.get(key);
  }

  function outfitMaterials(color) {
    if (!clothes.has(color)) {
      const base = new T.Color(color);
      const fabric = base.clone().lerp(new T.Color(0xe1cab4),.19);
      const accent = fabric.clone().multiplyScalar(.76);
      const outer = matte(fabric);
      outer.side = T.DoubleSide;
      clothes.set(color, {
        tops:Object.fromEntries(textileStyles.map(style => [style,new T.MeshStandardMaterial({
          color:fabric,map:garmentMaps[style],roughness:style==="puffer" ? .62 : .92
        })])),
        sleeve:matte(fabric), trim:matte(accent), outer,
        lining:matte(fabric.clone().lerp(new T.Color(0xeee3c8),.78)),
        padded:matte(fabric,.63), collar:matte(fabric.clone().lerp(new T.Color(0xe8d7bd),.13)),
        chima:new T.MeshStandardMaterial({color:fabric.clone().multiplyScalar(.80),vertexColors:true,roughness:.79,side:T.DoubleSide})
      });
    }
    return clothes.get(color);
  }

  function part(parent, geometry, material, x, y, z, sx, sy, sz) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    mesh.scale.set(sx,sy,sz);
    parent.add(mesh);
    return mesh;
  }

  function joint(parent, x=0, y=0, z=0) {
    const group = new T.Group();
    group.position.set(x,y,z);
    parent.add(group);
    return group;
  }

  function chain(parent, x, y, lengths, radii, material) {
    const upper = joint(parent,x,y);
    const lower = joint(upper,0,-lengths[0]);
    const end = joint(lower,0,-lengths[1]);
    const top = part(upper,segment,material,0,0,0,radii[0],lengths[0],radii[0]);
    const bottom = part(lower,segment,material,0,0,0,radii[1],lengths[1],radii[1]);
    return {upper,lower,end,top,bottom,lengths,target:new T.Vector3()};
  }

  function create(coat, nickname, labelSprite) {
    const group = joint(scene), pelvis = joint(group,0,.705), chest = joint(pelvis,0,.045);
    const palette = outfitMaterials(coat ?? 0xab5947);
    const torso = part(chest,torsoGeometry.coat,palette.lining,0,0,0,1,1,1);
    const waist = part(pelvis,sphere,pants,0,-.029,0,.204,.108,.130);
    part(chest,sphere,skin,0,.478,0,.106,.094,.100);
    const overcoat = joint(chest);
    part(overcoat,coatTop,palette.outer,0,0,0,1,1,1);
    part(overcoat,lapelGeometry,palette.trim,0,0,.223,1,1,1);
    part(overcoat,buttonsGeometry,details,0,0,0,1,1,1);
    const hem = part(pelvis,coatTail,palette.outer,0,.025,0,1,1,1);
    const pufferCollar = part(chest,sphere,palette.collar,0,.452,-.042,.180,.093,.159);
    const hanbokDetails = joint(chest);
    part(hanbokDetails,jeogoriCollar,ivory,0,0,.186,1,1,1);
    part(hanbokDetails,knotGeometry,details,.066,.31,.190,1,1,1);
    const skirt = part(pelvis,skirtGeometry,palette.chima,0,.259,0,1,1,1);

    const headJoint = joint(chest,0,.487,.011);
    const face = joint(headJoint,0,.323,.021);
    const faceMesh = part(face,head,faceMaterial("round",false,0),0,0,0,.332,.330,.303);
    const ears = part(face,earGeometry,earMaterials[0],0,0,0,1,1,1);
    const hairMesh = part(face,hairGeometry.short,hairMaterial,0,0,0,1,1,1);
    const pin = part(face,sphere,hairpin,.067,.374,.013,.135,.012,.014);
    pin.rotation.z = .31;

    const legs = SIDE.map(side => {
      const leg = chain(pelvis,side*.123,-.014,LEG,[.114,.088],pants);
      part(leg.end,footGeometry,details,0,0,0,1,1,1);
      return leg;
    });
    const arms = SIDE.map((side,i) => {
      const arm = chain(chest,side*.268,.405,ARM,[.098,.083],palette.sleeve);
      arm.cuff = part(arm.lower,sphere,palette.trim,0,-.208,0,.085,.045,.083);
      arm.shortSleeve = part(arm.upper,shortSleeve,palette.sleeve,0,0,0,.099,.159,.099);
      part(arm.end,handGeometry[i],details,0,0,0,1,1,1);
      return arm;
    });
    const itemPivot = joint(chest);
    itemPivot.visible = false;
    const label = nickname && labelSprite ? labelSprite(nickname,coat) : null;
    if (label) group.add(label);
    const emote = new T.Sprite(new T.SpriteMaterial({transparent:true,depthWrite:false,toneMapped:false}));
    emote.scale.set(.65,.65,1);
    emote.visible = false;
    group.add(emote);
    const shadow = new T.Mesh(shadowGeometry,new T.MeshBasicMaterial({color:0x27352d,transparent:true,opacity:.24,depthWrite:false}));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .028;
    group.add(shadow);
    group.visible = false;
    let offset = 0;
    for (const letter of String(nickname ?? "")) offset = (offset * 31 + letter.charCodeAt(0)) >>> 0;
    return {group,pelvis,chest,torso,waist,faceMesh,ears,headJoint,hairMesh,pin,overcoat,hem,pufferCollar,hanbokDetails,skirt,legs,arms,label,
      shadow,emote,itemPivot,itemProp:createItemProp(itemPivot),palette,offset,phase:(offset%100)/100,
      stride:0,sprint:0,seatBlend:0,petBlend:0,appearance:"",lastX:null,lastY:null};
  }

  const down = new T.Vector3(0,-1,0), forward = new T.Vector3(0,0,1);
  const target = new T.Vector3(), direction = new T.Vector3(), elbow = new T.Vector3(), bend = new T.Vector3();
  const pole = new T.Vector3(), clasp = new T.Vector3(), globalLower = new T.Quaternion();
  const pitch = new T.Quaternion(), inverseChest = new T.Quaternion();
  const xAxis = new T.Vector3(1,0,0);

  // Solve a two-segment limb from the end position and a preferred bend direction.
  function solve(limb, point, preferred) {
    const {upper,lower,lengths:[a,b]} = limb;
    target.copy(point).sub(upper.position);
    const length = clamp(target.length(),.095,a+b-.002);
    direction.copy(target).normalize();
    const along = (a*a-b*b+length*length)/(2*length);
    bend.copy(preferred).addScaledVector(direction,-preferred.dot(direction)).normalize();
    elbow.copy(direction).multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
    upper.quaternion.setFromUnitVectors(down,bend.copy(elbow).normalize());
    globalLower.setFromUnitVectors(down,bend.copy(direction).multiplyScalar(length).sub(elbow).normalize());
    lower.quaternion.copy(upper.quaternion).invert().multiply(globalLower);
  }

  function appearance(model, position, blink, blush) {
    const look = position.look;
    const hair = HAIR.includes(look?.hair) ? look.hair : position.character === "woman" ? "long" : "short";
    const eyes = EYES.includes(look?.eyes) ? look.eyes : "round";
    const requestedOutfit = look?.outfit === "hoodie" ? "puffer" : look?.outfit;
    const outfit = OUTFITS.includes(requestedOutfit) ? requestedOutfit : "coat";
    const chima = outfit === "hanbok" && position.character === "woman";
    const key = `${hair}/${eyes}/${outfit}/${chima}`;
    if (key !== model.appearance) {
      model.appearance = key;
      model.hairMesh.geometry = hairGeometry[hair];
      model.pin.visible = hair === "bun";
      model.torso.geometry = torsoGeometry[outfit];
      model.torso.material = outfit === "coat" ? model.palette.lining : model.palette.tops[outfit];
      model.torso.scale.set(chima ? .94 : 1,1,1);
      model.overcoat.visible = model.hem.visible = outfit === "coat";
      model.pufferCollar.visible = outfit === "puffer";
      model.hanbokDetails.visible = outfit === "hanbok";
      model.skirt.visible = chima;
      model.waist.material = outfit === "hanbok" ? hanbokPants : pants;
      for (const leg of model.legs) {
        const roomy = outfit === "hanbok" && !chima;
        leg.top.material = leg.bottom.material = model.waist.material;
        leg.top.scale.set(roomy ? .134 : .114,LEG[0],roomy ? .128 : .114);
        leg.bottom.scale.set(roomy ? .109 : .088,LEG[1],roomy ? .105 : .088);
        leg.top.visible = !chima;
        leg.bottom.visible = !chima;
      }
      for (const arm of model.arms) {
        const bare = outfit === "tee", padded = outfit === "puffer";
        arm.top.geometry = arm.bottom.geometry = padded ? paddedSleeve : segment;
        arm.top.material = arm.bottom.material = bare ? skin : padded ? model.palette.padded : model.palette.sleeve;
        const upperRadius = bare ? .077 : padded ? .110 : .098;
        const lowerRadius = bare ? .064 : padded ? .092 : .083;
        arm.top.scale.set(upperRadius,ARM[0],upperRadius);
        arm.bottom.scale.set(lowerRadius,ARM[1],lowerRadius);
        arm.cuff.visible = !bare;
        arm.shortSleeve.visible = bare;
      }
    }
    model.faceMesh.material = faceMaterial(eyes,blink,blush);
    model.ears.material = earMaterials[blush];
  }

  function update(model, position, {now,clock,delta=1/60,seat,floor=0,emojiTexture,turnEase=1}) {
    const {group,pelvis,chest,headJoint,legs,arms,itemPivot,emote} = model;
    const wasVisible = group.visible;
    group.visible = true;
    const smoothPose = wasVisible ? 1 - Math.exp(-delta*15) : 1;
    const walking = Boolean(position.stepping && !seat);
    const running = walking && position.running;
    const held = position.hand === -1 || position.hand === 1;
    const petAge = clock - position.pet?.at;
    const pet = !seat && !walking && !held && petAge >= 0 && petAge < PET_MS;
    const petPose = pet ? smooth(Math.min(petAge/235,(PET_MS-petAge)/275)) : 0;
    const waveAge = (clock - position.wave) / 1000;
    const item = position.item, spec = item && ITEMS[item.kind];
    const itemAge = spec && item.started ? Math.max(0,clock-item.started) : Infinity;
    const carrying = Boolean(spec && (item.remaining > 0 || itemAge < spec.duration));
    const waving = waveAge >= 0 && waveAge < 2.45 && !pet && !(held && carrying);
    const waveLift = waving ? smooth(Math.min(waveAge/.27,(2.45-waveAge)/.36)) : 0;

    const facing = Math.PI - (seat?.heading ?? position.heading ?? 252) * Math.PI/180;
    const turn = facing - group.rotation.y;
    group.rotation.y += Math.atan2(Math.sin(turn),Math.cos(turn)) * (wasVisible && !seat && !held ? turnEase : 1);
    group.position.set(wx(seat?.x ?? position.x),seat ? 0 : floor,wz(seat?.y ?? position.y));
    const travel = model.lastX === null ? 0 : Math.hypot(position.x-model.lastX,position.y-model.lastY);
    model.lastX = position.x;
    model.lastY = position.y;
    model.sprint = mix(model.sprint,Number(running),smoothPose);
    model.seatBlend = mix(model.seatBlend,Number(Boolean(seat)),smoothPose);
    model.petBlend = mix(model.petBlend,petPose,smoothPose);
    const sprint = model.sprint, seated = model.seatBlend, crouch = model.petBlend;
    const cycleDistance = mix(1.20,2.28,sprint), stance = mix(.57,.34,sprint);
    const velocity = mix(2.58,6.675,sprint);
    const strideTarget = walking ? (position.blocked ? .32 : 1) : 0;
    model.stride = mix(model.stride,strideTarget,smoothPose);
    const stride = model.stride;
    if (walking) {
      const distance = position.blocked || !wasVisible || travel > .6 ? velocity*delta : travel;
      model.phase = (model.phase + Math.max(distance,velocity*delta*.55)/cycleDistance)%1;
    }
    const phase = model.phase, pendulum = Math.sin(phase*TAU);
    const breath = Math.sin(now*.0025 + (model.offset%37)*.16);
    const sway = stride * (1-seated);
    const flight = stance < .5 ? Math.sin(Math.PI*clamp((phase%.5-stance)/(.5-stance))) : 0;
    const bob = (.009*(1-sprint)*(1-Math.cos(phase*TAU*2))+.065*sprint*flight)*sway;
    const strideDip = (.047+.024*sprint)*sway;
    const idleRise = .035*(1-stride)*(1-seated)*(1-crouch);
    pelvis.position.set(.013*pendulum*sway,.691+bob-strideDip+idleRise+breath*.004-seated*.145-crouch*.225,0);
    chest.rotation.set(.024 + sprint*.15 + crouch*.40 + seated*.04,pendulum*sway*.085,pendulum*sway*.048);
    headJoint.rotation.set(-.054-sprint*.080+crouch*.24, -pendulum*sway*.044,breath*.022+pendulum*sway*.018);
    model.shadow.visible = !seat;
    model.shadow.material.opacity = .25 - sprint*bob*1.12;
    model.shadow.scale.set(1+sprint*.05,1+crouch*.13,1);

    const blinkTick = (now + model.offset%4100) % 4120;
    const blushLevel = position.blushUntil > clock ? clamp(Math.trunc(Number(position.blushLevel))||1,1,3) : 0;
    appearance(model,position,blinkTick > 3970 && blinkTick < 4100,blushLevel);
    if (model.hem.visible) {
      model.hem.scale.set(1+seated*.08,1-seated*.61,1+stride*.13);
      model.hem.rotation.set(-seated*.37-sprint*.12,pendulum*sway*.065,pendulum*sway*.044);
    }
    if (model.skirt.visible) {
      model.skirt.scale.set(1+seated*.12,1-seated*.10-crouch*.24,1+stride*.18+seated*.16);
      model.skirt.rotation.set(-seated*.72-sprint*.085,pendulum*sway*.065,pendulum*sway*.059);
      for (const leg of legs) leg.bottom.visible = seated > .64;
    }
    for (let i=0;i<2;i++) {
      const side = SIDE[i], leg = legs[i];
      const footPhase = (phase + i*.5)%1;
      const swing = clamp((footPhase-stance)/(1-stance));
      const stroke = footPhase < stance ? stance*.5-footPhase : stance*(smooth(swing)-.5);
      const step = cycleDistance*stroke*stride;
      const lift = (.11+sprint*.12)*Math.sin(Math.PI*swing)*stride;
      const ankleY = SOLE+lift*(1-seated);
      leg.target.set(side*(.128+crouch*.033)-pelvis.position.x,ankleY-pelvis.position.y,
        mix(step+crouch*.09,.425,seated));
      solve(leg,leg.target,forward);
      const roll = (footPhase < stance ? 0 : Math.sin(swing*TAU)*.24*stride) * (1-seated);
      pitch.setFromAxisAngle(xAxis,roll+seated*.06);
      leg.end.quaternion.copy(globalLower).invert().multiply(pitch);
    }

    const waveSide = held ? -position.hand : carrying ? -1 : 1;
    const itemSide = held ? -position.hand : pet ? -1 : 1;
    const spark = carrying && item.kind === "sparkler";
    const eat = carrying && !spark && itemAge < spec.duration ? smooth(Math.min(itemAge/255,(spec.duration-itemAge)/360)) : 0;
    for (let i=0;i<2;i++) {
      const side = SIDE[i], arm = arms[i];
      let x = side*.299, y = -.036+seated*.118, z = .018+seated*.227;
      z += side*pendulum*sway*(.145+sprint*.10);
      y += sprint*sway*(.050+Math.max(0,side*pendulum)*.12);
      pole.set(side*.56,-.12,-1);
      const clasping = held && side === position.hand;
      if (clasping) {
        inverseChest.copy(chest.quaternion).invert();
        clasp.set(side*.519-pelvis.position.x,.795-pelvis.position.y-chest.position.y,.078).applyQuaternion(inverseChest);
        x = clasp.x; y = clasp.y; z = clasp.z;
      } else if (waving && side === waveSide) {
        x = mix(x,side*(.481+Math.sin(waveAge*17)*.085),waveLift);
        y = mix(y,.725+Math.cos(waveAge*17)*.034,waveLift);
        z = mix(z,.139,waveLift);
        pole.set(side,-.38,-.32);
      } else if (carrying && side === itemSide) {
        x = side*mix(.347,.124,eat); y = mix(.065,.550,eat); z = mix(.288,.324,eat);
        if (spark) { x = side*.414; y = .127; z = .302; }
        pole.set(side*.8,-.69,-.16);
      } else if (pet && side === 1) {
        const pat = Math.sin(petAge*.018)*.041;
        x = mix(x,.252,crouch); y = mix(y,.025+pat,crouch); z = mix(z,.374+pat,crouch);
        pole.set(side*.42,-.48,-.76);
      }
      const armEase = wasVisible && !clasping ? 1 - Math.exp(-delta*29) : 1;
      arm.target.set(mix(arm.target.x,x,armEase),mix(arm.target.y,y,armEase),mix(arm.target.z,z,armEase));
      solve(arm,arm.target,pole);
      arm.end.rotation.z = waving && side === waveSide ? side*waveLift*Math.sin(waveAge*21)*.20 : 0;
    }
    itemPivot.visible = carrying;
    if (carrying) {
      const hand = arms[itemSide===1?1:0].target;
      itemPivot.position.set(hand.x,hand.y+.015,hand.z+.039);
      itemPivot.rotation.set(spark ? .11 : -.66*eat,0,0);
    }
    model.itemProp(carrying?item.kind:null,spark&&item.started?itemAge/1000:-1);

    const reaction = position.emote, age = (clock-reaction?.at)/1000;
    emote.visible = age >= 0 && age < 3.15 && Boolean(emojiTexture);
    const labelY = (model.pin.visible ? 2.40 : 2.26)-seated*.145-crouch*.235;
    if (model.label) model.label.position.y = labelY;
    if (emote.visible) {
      const map = emojiTexture(reaction.emoji);
      if (emote.material.map !== map) { emote.material.map = map; emote.material.needsUpdate = true; }
      emote.position.y = labelY+.49+.058*Math.sin(now*.009);
      emote.material.opacity = Math.min(1,(3.15-age)*4);
    }
  }

  function dispose(model) {
    model.group.removeFromParent();
    model.shadow.material.dispose();
    model.emote.material.dispose();
    model.itemProp.dispose();
    if (model.label) {
      model.label.material.map.dispose();
      model.label.material.dispose();
    }
  }

  return {create,update,dispose};
}
