import {plazaAt} from "./plaza-layout.js";

export const plazaShowSpot=plazaAt(-15,28,"명량분수 음악분수");
export const PLAZA_SHOW_REACH=7;
export const PLAZA_SHOW_LEAD_MS=1_500;
export const PLAZA_SHOW_DURATION_MS=32_000;
export const PLAZA_SHOW_HEARING_METRES=60;
export const PLAZA_SHOW_VIEW_METRES=85;
export const PLAZA_SHOW_BEAT_MS=500;
export const PLAZA_SHOW_BEATS=PLAZA_SHOW_DURATION_MS/PLAZA_SHOW_BEAT_MS;

const unit=value=>Math.max(0,Math.min(1,value));

// This clock is shared by the visual choreography and the music scheduler.
export function plazaShowFrame(startAt,clock){
  const elapsed=clock-startAt;
  if(!Number.isFinite(elapsed)||startAt<=0||elapsed<0||elapsed>=PLAZA_SHOW_DURATION_MS)return null;
  const beat=elapsed/PLAZA_SHOW_BEAT_MS;
  return {elapsed,beat,section:Math.floor(beat/16),envelope:Math.min(unit(elapsed/800),unit((PLAZA_SHOW_DURATION_MS-elapsed)/1_350))};
}

// Four concentric arcs, numbered inside to outside, each travel from left to right.
export function plazaShowJet({beat,section},row,arc){
  const centre=1-Math.abs(arc-.5)*2;
  if(section===0){
    const ripples=.5+.5*Math.sin((beat*.5-row*.37-Math.abs(arc-.5)*.62)*Math.PI*2);
    return .16+ripples*ripples*.72+centre*.10;
  }
  if(section===1){
    const sweep=.5+.5*Math.cos((beat*.27+arc*1.12+row*.18)*Math.PI*2);
    return .18+sweep*sweep*.78;
  }
  if(section===2){
    const answer=.5+.5*Math.cos((beat*.25+(row%2)*.5+(arc<.5?0:.24))*Math.PI*2);
    return .18+answer*.76+centre*.06;
  }
  const crest=.5+.5*Math.cos((beat*.5-row*.17-Math.abs(arc-.5)*.34)*Math.PI*2);
  return .43+crest*.40+centre*.17;
}

const harmony=[
  [38,57,62,65], [34,53,58,62], [41,57,60,65], [36,55,60,64],
  [38,57,62,65], [34,53,58,62], [41,57,60,65], [36,55,60,67],
  [43,58,62,67], [38,57,62,65], [34,53,58,62], [36,55,60,64],
  [38,57,62,65], [34,53,58,65], [36,55,60,64], [41,57,60,65]
];
const melody=[
  [69,72,74,null], [70,69,65,null], [69,72,77,76], [72,null,67,null],
  [74,77,81,null], [82,81,77,74], [72,77,81,84], [79,77,76,null],
  [79,82,86,84], [81,77,74,null], [77,74,70,72], [76,79,84,null],
  [81,86,89,88], [86,82,81,77], [79,84,88,86], [84,81,77,null]
];

// Original four-part cue sheet. MIDI notes are converted to tones by sound.js.
export function plazaShowNotes(beat){
  if(!Number.isInteger(beat)||beat<0||beat>=PLAZA_SHOW_BEATS)return [];
  const bar=Math.floor(beat/4),count=beat%4,[bass,...chord]=harmony[bar];
  const notes=[];
  if(count===0){
    notes.push({voice:"bass",note:bass,length:.95,offset:0,gain:.14});
    for(const note of chord)notes.push({voice:"pad",note,length:1.78,offset:0,gain:.022});
  }else if(count===2&&bar<15){
    notes.push({voice:"bass",note:bass+12,length:.65,offset:0,gain:.080});
  }
  const lead=melody[bar][count];
  if(lead!=null)notes.push({voice:"bell",note:lead,length:bar===15&&count===2?.86:.41,offset:0,gain:.105});
  if(bar>=4&&bar<15)notes.push({voice:"bell",note:chord[(count+bar)%3]+12,length:.32,offset:.24,gain:bar>=12?.074:.045});
  return notes;
}
