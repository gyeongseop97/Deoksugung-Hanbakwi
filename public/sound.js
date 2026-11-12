// A small synthesized soundscape: footsteps, wading, birdsong, crickets, a cat's meow, the
// transit chimes, passing buses and the guard drum. Everything is generated with Web Audio, so there are no
// audio files to load. Sound starts on the first tap or key press, as browsers require.
export function makeSound(){
  let context=null,master=null,noise=null,engine=null,engineStop=null;
  let enabled=localStorage.getItem("jeongdong-sound")!=="off";
  const fraction=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  function ready(){
    if(!enabled)return null;
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return null;
      try{context=new Audio();}catch{return null;}
      master=context.createGain();master.gain.value=.55;master.connect(context.destination);
      const length=Math.floor(context.sampleRate*.5);
      noise=context.createBuffer(1,length,context.sampleRate);
      const data=noise.getChannelData(0);
      for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    }
    if(context.state==="suspended"||context.state==="interrupted")context.resume().catch(()=>{});
    return context;
  }
  const playing=()=>enabled&&context?.state==="running"?context:null;

  function startEngine(ctx){
    const motor=ctx.createOscillator(),rattle=ctx.createOscillator(),tires=ctx.createBufferSource();
    const rattleLevel=ctx.createGain(),tireLevel=ctx.createGain(),tireBand=ctx.createBiquadFilter();
    const muffler=ctx.createBiquadFilter(),volume=ctx.createGain();
    motor.type=rattle.type="triangle";
    motor.frequency.value=43;rattle.frequency.value=89;rattleLevel.gain.value=.13;
    tires.buffer=noise;tires.loop=true;
    tireBand.type="bandpass";tireBand.frequency.value=135;tireBand.Q.value=.78;tireLevel.gain.value=.10;
    muffler.type="lowpass";muffler.frequency.value=260;muffler.Q.value=.56;volume.gain.value=0;
    motor.connect(muffler);rattle.connect(rattleLevel);rattleLevel.connect(muffler);
    tires.connect(tireBand);tireBand.connect(tireLevel);tireLevel.connect(muffler);
    muffler.connect(volume);volume.connect(master);
    const sources=[motor,rattle,tires];
    for(const source of sources)source.start();
    engine={motor,rattle,tireLevel,tireBand,muffler,volume,sources,
      nodes:[...sources,rattleLevel,tireLevel,tireBand,muffler,volume],at:-Infinity};
  }
  function stopEngine(){
    clearTimeout(engineStop);engineStop=null;
    if(!engine)return;
    for(const source of engine.sources)source.stop();
    for(const node of engine.nodes)node.disconnect();
    engine=null;
  }
  function fadeEngine(){
    if(!engine||engineStop!==null)return;
    engine.volume.gain.setTargetAtTime(0,context.currentTime,.065);
    engineStop=setTimeout(stopEngine,320);
  }
  function bus(source){
    const ctx=playing(),inside=Boolean(source?.inside),distance=source?.distance;
    const proximity=inside?1:fraction(1-distance/62)**1.75;
    if(!source||!ctx||proximity<.004){fadeEngine();return;}
    if(!engine)startEngine(ctx);
    if(engineStop!==null){clearTimeout(engineStop);engineStop=null;engine.at=-Infinity;}
    const now=ctx.currentTime;
    if(now-engine.at<.05)return;
    engine.at=now;
    const speed=source.moving?fraction((source.speed??8)/13):0;
    const motorPitch=43+speed*43;
    engine.motor.frequency.setTargetAtTime(motorPitch,now,.12);
    engine.rattle.frequency.setTargetAtTime(motorPitch*2.07,now,.12);
    engine.tireBand.frequency.setTargetAtTime(135+speed*450,now,.18);
    engine.tireLevel.gain.setTargetAtTime(.075+speed*.24,now,.16);
    engine.muffler.frequency.setTargetAtTime(inside?155+speed*115:265+speed*350,now,.19);
    engine.volume.gain.setTargetAtTime(proximity*(inside?.085:.115)*(.68+speed*.32),now,.11);
  }
  // A short burst of filtered noise: the body of a footstep, a splash or a drum.
  function burst({type="lowpass",frequency=900,q=1,gain=.2,attack=.004,decay=.09,rate=1}){
    const ctx=playing();
    if(!ctx)return;
    const start=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=ctx.createGain();
    source.buffer=noise;source.playbackRate.value=rate;
    filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
    amp.gain.setValueAtTime(.0001,start);amp.gain.linearRampToValueAtTime(gain,start+attack);
    amp.gain.exponentialRampToValueAtTime(.0001,start+attack+decay);
    source.connect(filter);filter.connect(amp);amp.connect(master);
    source.start(start);source.stop(start+attack+decay+.05);
  }
  function tone(from,to,{gain=.12,attack=.01,decay=.25,type="sine",delay=0}={}){
    const ctx=playing();
    if(!ctx)return;
    const start=ctx.currentTime+delay,voice=ctx.createOscillator(),amp=ctx.createGain();
    voice.type=type;voice.frequency.setValueAtTime(from,start);voice.frequency.exponentialRampToValueAtTime(to,start+attack+decay);
    amp.gain.setValueAtTime(.0001,start);amp.gain.linearRampToValueAtTime(gain,start+attack);
    amp.gain.exponentialRampToValueAtTime(.0001,start+attack+decay);
    voice.connect(amp);amp.connect(master);
    voice.start(start);voice.stop(start+attack+decay+.05);
  }
  return {
    get enabled(){return enabled;},
    wake:ready,
    toggle(){
      enabled=!enabled;localStorage.setItem("jeongdong-sound",enabled?"on":"off");
      if(enabled)ready();
      else{stopEngine();context?.suspend().catch(()=>{});}
      return enabled;
    },
    bus,
    step(surface){
      if(surface==="water")burst({type:"bandpass",frequency:620,q:.7,gain:.2,decay:.24,rate:.6});
      else if(surface==="wood")burst({frequency:380,gain:.17,decay:.07});
      else burst({type:"bandpass",frequency:1500,q:.9,gain:.075,decay:.05});
    },
    chirp(relativeGain=1){
      const gain=.03*fraction(relativeGain);
      if(!gain)return;
      const base=2400+Math.random()*1400,notes=2+Math.floor(Math.random()*3);
      for(let i=0;i<notes;i++)tone(base,base*(1.2+Math.random()*.3),{gain,attack:.008,decay:.07,delay:i*.11});
    },
    cricket(){for(let i=0;i<4;i++)tone(4300,4250,{gain:.016,attack:.004,decay:.03,delay:i*.055,type:"triangle"});},
    meow(relativeGain=1){
      const gain=.07*fraction(relativeGain);
      if(!gain)return;
      tone(620,880,{gain,attack:.05,decay:.12,type:"triangle"});
      tone(880,520,{gain,attack:.02,decay:.32,type:"triangle",delay:.16});
    },
    chime(mode){
      const notes=mode==="bus"?[784,988]:[659,523,659,784];
      notes.forEach((pitch,i)=>tone(pitch,pitch,{gain:.1,decay:.5,delay:i*.26}));
    },
    drum(){burst({frequency:150,gain:.5,decay:.36,rate:.35});}
  };
}
