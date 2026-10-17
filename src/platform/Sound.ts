import type { GameEvent } from '../data/types';
import type { Settings } from '../data/options';
import { defaultSettings } from '../data/options';
import type { Race } from '../gameplay/Race';

export class Sound {
  private context:AudioContext|null=null;private master:GainNode|null=null;private music:GainNode|null=null;private effects:GainNode|null=null;
  private filter:BiquadFilterNode|null=null;private engine:OscillatorNode|null=null;private engineGain:GainNode|null=null;
  private voices=0;private silent=false;private settings=defaultSettings();private beat=-1;private drift=[0,0];private warningTime=0;
  get muted():boolean{return this.silent;}
  set muted(value:boolean){this.settings.muted=value;this.apply(this.settings);}
  apply(settings:Settings):void{
    this.settings=structuredClone(settings);this.silent=settings.muted;const time=this.context?.currentTime??0;
    this.master?.gain.setValueAtTime(this.muted?0:settings.masterVolume,time);this.music?.gain.setValueAtTime(settings.musicVolume,time);this.effects?.gain.setValueAtTime(settings.effectsVolume,time);
  }
  unlock():void{
    try{
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.music=this.context.createGain();this.effects=this.context.createGain();this.filter=this.context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=8000;
        this.music.connect(this.filter);this.effects.connect(this.filter);this.filter.connect(this.master).connect(this.context.destination);
        this.engine=this.context.createOscillator();this.engine.type='triangle';this.engineGain=this.context.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain).connect(this.effects);this.engine.start();this.apply(this.settings);
      }
      void this.context.resume().catch(()=>{});
    }catch{/* Graphics/gameplay remain usable if the browser denies audio. */}
  }
  private play(frequency:number,duration:number,channel:'music'|'effects',priority=false):void{
    const ctx=this.context;if(!ctx||this.muted||ctx.state!=='running'||this.voices>=(priority?10:7))return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=channel==='music'?'sine':'triangle';oscillator.frequency.setValueAtTime(frequency,ctx.currentTime);
    gain.gain.setValueAtTime(channel==='music'?.045:.035,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    oscillator.connect(gain).connect(channel==='music'?this.music!:this.effects!);oscillator.start();oscillator.stop(ctx.currentTime+duration);this.voices++;
    oscillator.onended=()=>{this.voices--;oscillator.disconnect();gain.disconnect();};
  }
  tone(frequency:number,duration=.12,priority=false):void{this.play(frequency,duration,'effects',priority);}
  update(race:Race):void{
    const ctx=this.context;if(!ctx||ctx.state!=='running')return;
    const active=['racing','finished'].includes(race.state),speed=race.humans.reduce((sum,r)=>sum+Math.abs(r.controller.state.speed),0)/race.humans.length;
    this.engine?.frequency.setTargetAtTime(55+speed*6,ctx.currentTime,.08);this.engineGain?.gain.setTargetAtTime(active?.018:0,ctx.currentTime,.08);
    this.filter?.frequency.setTargetAtTime(race.player.controller.state.traversal==='underwater'?900:8000,ctx.currentTime,.15);
    const beat=Math.floor(race.time/.3);if(active&&beat!==this.beat){this.beat=beat;const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];this.play(notes[beat%notes.length]!, .23,'music');}
    for(let i=0;i<race.humans.length;i++){const stage=race.humans[i]!.controller.state.driftStage;if(stage>this.drift[i]!)this.tone([0,620,830,1040][stage]!, .16);this.drift[i]=stage;}
    if(race.time-this.warningTime>.9&&race.humans.some((r)=>r.warning)){this.warningTime=race.time;this.tone(940,.1,true);}
  }
  event(event:GameEvent):void{
    if(!('racerId'in event)||!event.racerId.startsWith('player-'))return;
    if(event.type==='pickup')this.tone(event.item==='coin'?1000:700);
    if(event.type==='use'||event.type==='boost')this.tone(440,.2);if(event.type==='hit')this.tone(130,.25,true);if(event.type==='finish')this.tone(880,.45,true);if(event.type==='rescue')this.tone(230,.2);
  }
  reset():void{this.beat=-1;this.drift=[0,0];this.warningTime=0;}
  pause():void{void this.context?.suspend().catch(()=>{});}
  dispose():void{this.engine?.stop();this.engine?.disconnect();this.engineGain?.disconnect();void this.context?.close().catch(()=>{});}
}
