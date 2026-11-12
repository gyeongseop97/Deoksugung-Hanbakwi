const FALL_SHADER = `
  attribute vec4 particle;
  uniform vec2 anchor, wind;
  uniform vec3 umbrella;
  uniform float clock, baseHeight, shelter, pixelRatio, strength;
  varying float opacity;
  void main() {
    float snow = float(IS_SNOW);
    float age = clock + particle.z * 30.;
    float speed = mix(11. + particle.w * 8., .65 + particle.w * .85, snow);
    float height = 12. - mod(age * speed, 12.);
    float fallTime = (12. - height) / speed;
    vec2 drift = wind * fallTime * mix(.65, .27, snow);
    drift += vec2(sin(age * 1.65 + particle.x), cos(age * 1.12 + particle.y)) * .46 * snow;
    vec2 horizontal = mod(particle.xy + drift - anchor + 15., 30.) - 15.;
    vec3 world = vec3(anchor.x + horizontal.x, baseHeight + height, anchor.y + horizontal.y);
    world.y += position.x * (.25 + particle.w * .27) * (1. - snow);
    world.xz -= position.x * wind * .022 * (1. - snow);
    float distanceFromCamera = length(horizontal);
    float underUmbrella = 1. - shelter * (1. - smoothstep(.52, .79, length(world.xz - umbrella.xz))) *
      (1. - smoothstep(1.69, 1.86, world.y - umbrella.y));
    vec4 cameraPoint = viewMatrix * vec4(world, 1.);
    opacity = (1. - smoothstep(10., 14.8, distanceFromCamera)) * underUmbrella *
      smoothstep(.30, 1.2, -cameraPoint.z) * mix(.35, .85, particle.w) * strength;
    gl_Position = projectionMatrix * cameraPoint;
    gl_PointSize = clamp((2.5 + 9.5 / max(1.2, -cameraPoint.z)) * (.62 + particle.w * .54) * pixelRatio, 2., 12.);
  }
`;

const FALL_COLOR = `
  varying float opacity;
  uniform vec3 tint;
  void main() {
    float alpha = opacity;
    #if IS_SNOW == 1
      alpha *= 1. - smoothstep(.18, .49, length(gl_PointCoord - .5));
    #endif
    if (alpha < .009) discard;
    gl_FragColor = vec4(tint, alpha);
    #include <colorspace_fragment>
  }
`;

export function addSeoulPrecipitation(T, parent) {
  const dayRain = new T.Color(0xa3c1d0), nightRain = new T.Color(0x81a1c9);
  const daySnow = new T.Color(0xf8fcff), nightSnow = new T.Color(0xc3d5ef);
  function build(snow, count) {
    let seed = snow ? 39763 : 84139;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const vertices = snow ? 1 : 2;
    const positions = new Float32Array(count * vertices * 3);
    const particles = new Float32Array(count * vertices * 4);
    for (let i = 0; i < count; i++) {
      const data = [random() * 30, random() * 30, random(), random()];
      for (let j = 0; j < vertices; j++) {
        positions[(i * vertices + j) * 3] = j;
        particles.set(data, (i * vertices + j) * 4);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("particle", new T.BufferAttribute(particles, 4));
    const uniforms = {
      anchor: { value: new T.Vector2() }, wind: { value: new T.Vector2() }, umbrella: { value: new T.Vector3() },
      clock: { value: 0 }, baseHeight: { value: 0 }, shelter: { value: 0 }, strength: { value: 0 },
      pixelRatio: { value: 1 }, tint: { value: new T.Color() }
    };
    const material = new T.ShaderMaterial({
      defines: { IS_SNOW: Number(snow) }, vertexShader: FALL_SHADER,
      fragmentShader: FALL_COLOR, uniforms, transparent: true, depthWrite: false, toneMapped: false
    });
    const mesh = snow ? new T.Points(geometry, material) : new T.LineSegments(geometry, material);
    mesh.name = snow ? "Seoul weather snow" : "Seoul weather rain";
    mesh.frustumCulled = false;
    mesh.visible = false;
    parent.add(mesh);
    return { mesh, geometry, uniforms, count, vertices };
  }
  const rain = build(false, 1050);
  const snow = build(true, 720);
  return function update({ x, z, floor, walkerX=x, walkerZ=z, walkerFloor=floor,
    clock, atmosphere, sheltered, inside, sparse, pixelRatio, night }) {
    function draw(effect, amount, dayColor, nightColor, alpha) {
      const { mesh, geometry, uniforms, count, vertices } = effect;
      mesh.visible = !inside && amount > .018;
      if (!mesh.visible) return;
      geometry.setDrawRange(0, Math.round(count * (.25 + amount * .75) * (sparse ? .62 : 1)) * vertices);
      uniforms.anchor.value.set(x, z);
      uniforms.wind.value.set(atmosphere.windX, atmosphere.windZ);
      uniforms.umbrella.value.set(walkerX, walkerFloor, walkerZ);
      uniforms.clock.value = (clock % 3600000) / 1000;
      uniforms.baseHeight.value = floor;
      uniforms.shelter.value = Number(sheltered);
      uniforms.pixelRatio.value = pixelRatio;
      uniforms.strength.value = alpha * Math.min(1, amount * 1.7);
      uniforms.tint.value.copy(dayColor).lerp(nightColor, night);
    }
    draw(rain, atmosphere.rain, dayRain, nightRain, .63);
    draw(snow, atmosphere.snow, daySnow, nightSnow, .86);
  };
}

export function makeSeasonFoliage(T) {
  const crowns = new Set();
  const leafTint = { value: new T.Color() }, leafMix = { value: 0 };
  const groundTint = { value: new T.Color() }, groundMix = { value: 0 };
  const evergreenTint = { value: new T.Color() }, evergreenMix = { value: 0 };
  let winter = false;
  function register(material, kind) {
    if (material.userData.seasonRegistered) return;
    material.userData.seasonFoliage = kind;
    material.userData.seasonRegistered = true;
    const [tint, blend] = kind === "leaf" ? [leafTint, leafMix] :
      kind === "evergreen" ? [evergreenTint, evergreenMix] : [groundTint, groundMix];
    if (kind === "leaf") {
      crowns.add(material);
      material.visible = !winter;
    }
    material.onBeforeCompile = shader => {
      shader.uniforms.seasonTint = tint;
      shader.uniforms.seasonBlend = blend;
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
        "#include <common>\nuniform vec3 seasonTint;\nuniform float seasonBlend;").replace(
        "#include <color_fragment>", `#include <color_fragment>
          float foliageLight = .58 + dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)) * .86;
          diffuseColor.rgb = mix(diffuseColor.rgb, seasonTint * foliageLight, seasonBlend);`);
    };
    material.customProgramCacheKey = () => "seoul-season-foliage";
  }
  function update(season, snow) {
    const dormant = season === "winter";
    if (winter !== dormant) {
      winter = dormant;
      for (const material of crowns) material.visible = !winter;
    }
    leafTint.value.setHex(season === "spring" ? 0x9bc75f : 0x5eab52);
    leafMix.value = season === "spring" ? .88 : season === "summer" ? .85 : 0;
    groundTint.value.setHex(winter ? 0xc5c9bc : season === "spring" ? 0x9abc69 : 0x71984f);
    groundMix.value = winter ? .5 + snow * .3 : season === "autumn" ? snow * .38 : .73;
    evergreenTint.value.setHex(0xb5c9c8);
    evergreenMix.value = snow * .56 + (winter ? .07 : 0);
  }
  return { register, update };
}
