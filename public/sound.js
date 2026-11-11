// A small synthesized soundscape: footsteps, wading, birdsong, crickets, a cat's meow, the
// transit chimes and the guard drum. Everything is generated with Web Audio, so there are no
// audio files to load. Sound starts on the first tap or key press, as browsers require.
export function makeSound(){
  let context=null,master=null,noise=null;
  let enabled=localStorage.getItem("jeongdong-sound")!=="off";
  function ready(){
    if(!enabled)return null;
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return null;
      context=new Audio();
      master=context.createGain();master.gain.value=.55;master.connect(context.destination);
      const length=Math.floor(context.sampleRate*.5);
      noise=context.createBuffer(1,length,context.sampleRate);
      const data=noise.getChannelData(0);
      for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    }
    if(context.state==="suspended")context.resume();
    return context;
  }
  // A short burst of filtered noise: the body of a footstep, a splash or a drum.
  function burst({type="lowpass",frequency=900,q=1,gain=.2,attack=.004,decay=.09,rate=1}){
    const ctx=ready();
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
    const ctx=ready();
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
      if(enabled)ready();else context?.suspend();
      return enabled;
    },
    step(surface){
      if(surface==="water")burst({type:"bandpass",frequency:620,q:.7,gain:.2,decay:.24,rate:.6});
      else if(surface==="wood")burst({frequency:380,gain:.17,decay:.07});
      else burst({type:"bandpass",frequency:1500,q:.9,gain:.075,decay:.05});
    },
    chirp(){
      const base=2400+Math.random()*1400,notes=2+Math.floor(Math.random()*3);
      for(let i=0;i<notes;i++)tone(base,base*(1.2+Math.random()*.3),{gain:.03,attack:.008,decay:.07,delay:i*.11});
    },
    cricket(){for(let i=0;i<4;i++)tone(4300,4250,{gain:.016,attack:.004,decay:.03,delay:i*.055,type:"triangle"});},
    meow(){
      tone(620,880,{gain:.07,attack:.05,decay:.12,type:"triangle"});
      tone(880,520,{gain:.07,attack:.02,decay:.32,type:"triangle",delay:.16});
    },
    chime(mode){
      const notes=mode==="bus"?[784,988]:[659,523,659,784];
      notes.forEach((pitch,i)=>tone(pitch,pitch,{gain:.1,decay:.5,delay:i*.26}));
    },
    drum(){burst({frequency:150,gain:.5,decay:.36,rate:.35});}
  };
}
