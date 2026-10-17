import type { CourseDefinition,GameEvent,ItemKind,KartState,RaceState } from '../data/types';
import type { RaceOptions,Settings } from '../data/options';
import { raceOptions } from '../data/options';
import { itemKinds } from '../data/items';
import { FixedStep } from './FixedStep';
import { KartController } from '../gameplay/KartController';
import { Race } from '../gameplay/Race';
import { Battle } from '../gameplay/Battle';
import { createArena } from '../tracks/arena';
import { Session } from '../gameplay/Session';
import { Keyboard } from '../platform/Keyboard';
import { Sound } from '../platform/Sound';
import { SaveStore,validateSettings } from '../platform/SaveStore';
import { GhostStore,GhostRecorder,ghostKey } from '../platform/Ghosts';
import { Renderer } from '../rendering/Renderer';
import { createCourse } from '../tracks/course';
import { Interface,formatTime } from '../ui/Interface';

export class Game {
  private readonly saves=new SaveStore();private readonly ghosts=new GhostStore();private readonly session=new Session(this.saves);
  private readonly compact=new URLSearchParams(location.search).get('course')==='short';
  private state:RaceState='boot';
  private playfield(options:RaceOptions):CourseDefinition{return options.mode==='balloon-battle'?createArena():createCourse(options.course,options.mirrored,this.compact);}
  private course:CourseDefinition=this.playfield(raceOptions(this.saves.data.settings));
  private race:Race=this.saves.data.settings.mode==='balloon-battle'?new Battle(this.course,4782,raceOptions(this.saves.data.settings)):new Race(this.course,4782,raceOptions(this.saves.data.settings));
  private menuKart=new KartController(this.course,this.course.spawn,this.saves.data.settings.builds[0],this.saves.data.settings.speed).state;
  private readonly input=new Keyboard();private readonly sound=new Sound();private readonly clock=new FixedStep();
  private readonly ui:Interface;private readonly rendering:Renderer;
  private lastFrame=0;private animation=0;private snapCamera=true;private countdownCue=4;private loadToken=0;private completed:Race|null=null;private recorder:GhostRecorder|null=null;private graphicsLost=false;
  private readonly visual:KartState={...this.race.player.controller.state};
  private readonly onResize=()=>this.rendering.resize();private readonly onVisibility=()=>{if(document.hidden)this.pause();this.lastFrame=0;};private readonly onBlur=()=>this.pause();private readonly onControls=()=>this.pause();
  private readonly onForceItem=(event:Event)=>{const item=(event as CustomEvent<unknown>).detail;if(itemKinds.includes(item as ItemKind))this.race.player.inventory.add(item as ItemKind);};
  private readonly onContextLost=(event:Event)=>{event.preventDefault();this.graphicsLost=true;this.pause();this.ui.graphicsLost();};
  constructor(root:HTMLElement){
    this.ui=new Interface(root,this.saves.data,this.saves.status);this.setState('loading');
    this.rendering=new Renderer(document.querySelector('#world')!,this.course);this.rendering.applySettings(this.saves.data.settings);this.rendering.previewBuild(this.saves.data.settings.builds[0]);
    this.input.configure(this.saves.data.settings);this.sound.apply(this.saves.data.settings);this.ui.setCourse(this.course);
    this.ui.onStart=()=>{void this.start();};this.ui.onPause=()=>this.pause();this.ui.onRestart=()=>{void this.restart();};this.ui.onResume=()=>this.resume();this.ui.onMenu=()=>this.menu();
    this.ui.onSettings=(settings)=>this.changeSettings(settings);this.ui.onSound=()=>this.changeSettings({...this.saves.data.settings,muted:!this.saves.data.settings.muted,masterVolume:this.saves.data.settings.masterVolume||.65});
    this.ui.onResumeCup=()=>{const options=this.session.resumeCup();if(options)void this.load(options);};this.ui.onContinueCup=()=>{void this.load(this.session.nextCupRace());};
    this.ui.onAbandonCup=()=>{this.session.abandonCup();this.refreshMenus();this.ui.message('Saved cup abandoned.');};
    this.ui.onPreview=(index)=>this.rendering.previewBuild(this.saves.data.settings.builds[index as 0|1]);this.ui.onTouch=(action,pressed,id)=>this.input.touch(action,pressed,id);
    this.ui.onFullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void document.documentElement.requestFullscreen().catch(()=>this.ui.message('Fullscreen is unavailable. You can keep playing in this window.'));};
    this.ui.onExport=()=>this.exportSave();this.ui.onImport=(json)=>this.importSave(json);this.ui.onReset=()=>{void this.resetProgress();};
    this.input.onPause=()=>this.state==='paused'?this.resume():this.pause();this.input.onRestart=()=>{void this.restart();};this.input.onDisconnect=(player)=>{this.pause();this.ui.controllerDisconnected(player);};
    window.addEventListener('resize',this.onResize);window.addEventListener('blur',this.onBlur);document.addEventListener('visibilitychange',this.onVisibility);document.addEventListener('open-controls',this.onControls);
    if(import.meta.env.DEV)document.addEventListener('kart:force-item',this.onForceItem);
    this.rendering.renderer.domElement.addEventListener('webglcontextlost',this.onContextLost);
    this.setState('menu');this.refreshMenus();this.animation=requestAnimationFrame(this.frame);
  }
  private setState(state:RaceState,resetTiming=true):void{
    this.state=state;this.input.active=['countdown','racing','paused','finished'].includes(state);this.input.driving=['countdown','racing','finished'].includes(state);
    if(['menu','paused','results','countdown','loading'].includes(state))this.input.clear();if(resetTiming){this.clock.reset();this.lastFrame=0;}this.ui.setState(state);
    if(['menu','paused','results','loading'].includes(state))this.sound.pause();this.emit({type:'state',state});
  }
  private emit(event:GameEvent):void{this.sound.event(event);document.dispatchEvent(new CustomEvent('kart:event',{detail:event}));}
  private refreshMenus():void{
    this.ui.setData(this.saves.data,this.saves.status);const settings=this.saves.data.settings;
    if(settings.mode==='time-trial'){
      const course=createCourse(settings.course,settings.mirrored,this.compact),key=ghostKey(raceOptions(settings),course.version),best=this.saves.data.bests[key];this.ui.setBest(best?`Local personal best: ${formatTime(best.time)} · this vehicle, speed and course`:'No local best for this vehicle / speed / course yet.');
    }else this.ui.setBest(this.compact?'Compact verification course scale is active.':'');
  }
  private changeSettings(source:Settings):void{
    const previous=this.saves.data.settings,settings=validateSettings(source);this.saves.data.settings=settings;this.saves.save();this.input.configure(settings);this.sound.apply(settings);this.rendering.applySettings(settings);
    if(this.state==='menu'){
      if(previous.course!==settings.course||previous.mirrored!==settings.mirrored||previous.mode!==settings.mode){this.course=this.playfield(raceOptions(settings));this.rendering.setCourse(this.course);this.ui.setCourse(this.course);this.snapCamera=true;}
      this.menuKart=new KartController(this.course,this.course.spawn,settings.builds[0],settings.speed).state;this.rendering.previewBuild(settings.builds[0]);
    }
    this.refreshMenus();
  }
  private async start():Promise<void>{await this.load(this.session.begin(raceOptions(this.saves.data.settings)));}
  private async restart():Promise<void>{await this.load(this.session.active);}
  private async load(options:RaceOptions):Promise<void>{
    if(this.graphicsLost)return;
    const token=++this.loadToken;this.sound.unlock();this.setState('loading');this.ui.setLoading(.1,'Constructing the selected course…');
    try{
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));if(token!==this.loadToken)return;
      this.course=this.playfield(options);this.rendering.setCourse(this.course);this.ui.setCourse(this.course);this.ui.setLoading(.5,'Assembling racers and vehicle parts…');
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));if(token!==this.loadToken)return;
      this.race=options.mode==='balloon-battle'?new Battle(this.course,4782,options):new Race(this.course,4782+(options.mode==='grand-prix'?(this.saves.data.cup?.nextRace??0)*901:0),options);
      this.recorder=options.mode==='time-trial'?new GhostRecorder():null;this.recorder?.sample(0,this.race.player.controller.state);this.completed=null;
      this.ui.setLoading(.8,'Reading local ghost data…');const ghost=options.mode==='time-trial'&&this.saves.data.settings.ghost?await this.ghosts.get(ghostKey(options,this.course.version),this.course.version):null;if(token!==this.loadToken)return;
      this.rendering.setGhost(ghost);this.rendering.applySettings(this.saves.data.settings);this.input.configure({...this.saves.data.settings,players:options.players});
      this.menuKart=new KartController(this.course,this.course.spawn,options.builds[0],options.speed).state;this.snapCamera=true;this.countdownCue=4;this.ui.clearLap();this.refreshMenus();this.ui.setLoading(1,'Ready for the grid.');
      this.sound.reset();this.sound.unlock();this.setState('countdown');if(ghost)this.ui.message('Local ghost loaded for this course, vehicle and speed.');if(document.hidden)this.pause();
    }catch(error){console.error(error);if(token===this.loadToken){this.setState('loading');this.ui.loadFailed('Reload or retry this course. Your saved progress is retained.');}}
  }
  private menu():void{
    this.loadToken++;this.recorder=null;this.rendering.setGhost(null);this.sound.reset();
    const settings=this.saves.data.settings;this.course=this.playfield(raceOptions(settings));this.rendering.setCourse(this.course);this.ui.setCourse(this.course);this.rendering.previewBuild(settings.builds[0]);this.menuKart=new KartController(this.course,this.course.spawn,settings.builds[0],settings.speed).state;
    this.snapCamera=true;this.setState('menu');this.refreshMenus();
  }
  private pause():void{if(['countdown','racing','finished'].includes(this.state)){this.race.pause();this.setState('paused');}}
  private resume():void{if(this.state==='paused'&&!this.graphicsLost&&!this.ui.controls.open&&!document.hidden){this.race.resume();this.sound.unlock();this.ui.resumed();this.setState(this.race.state);}}
  private acceptResults():void{
    const race=this.race;if(this.completed===race)return;this.completed=race;this.session.accept(race);const record=this.session.recordTrial(race);this.refreshMenus();this.ui.showResults(race);
    if(record){
      if(record.improved&&this.recorder){const ghost=this.recorder.finish(record.key,race.course.version,race.player.finishTime!,race.player.controller.state);this.ui.resultNote(`New local best: ${formatTime(record.best)}. Saving ghost…`);void this.ghosts.put(ghost).then(()=>{if(this.completed===race)this.ui.resultNote(`New local best: ${formatTime(record.best)}. ${this.ghosts.status}`);});}
      else this.ui.resultNote(`Local personal best: ${formatTime(record.best)}. The best ghost is retained.`);
    }
  }
  private exportSave():void{const blob=new Blob([this.saves.export()],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='pocket-circuit-save.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  private importSave(json:string):void{if(!this.saves.import(json)){this.ui.message('That file is not a supported progress save.');return;}this.changeSettings(this.saves.data.settings);this.menu();this.ui.showSetup();this.ui.message('Local progress imported. Ghost recordings remain in this device’s ghost database.');}
  private async resetProgress():Promise<void>{this.saves.resetProgress();await this.ghosts.clear();this.menu();this.ui.message('Local progress and ghosts cleared. Settings are retained.');}
  private readonly frame=(timestamp:number)=>{
    this.animation=requestAnimationFrame(this.frame);
    const dt=this.lastFrame?Math.min((timestamp-this.lastFrame)/1000,.1):0;this.lastFrame=timestamp;this.input.poll();let alpha=1;
    if(['countdown','racing','finished'].includes(this.state)){
      alpha=this.clock.advance(dt,(step)=>{
        for(const event of this.race.update(this.input.consumeAll(),step)){if(event.type!=='state')this.emit(event);this.ui.event(event,this.race);}
        if(this.recorder&&this.race.time>0&&this.race.player.finishTime===null)this.recorder.sample(this.race.time,this.race.player.controller.state);
        if(this.race.state!==this.state){if(this.race.state==='results')this.acceptResults();this.setState(this.race.state,false);}
      });
      const cue=this.state==='countdown'?Math.ceil(this.race.countdown):0;if(cue!==this.countdownCue){this.countdownCue=cue;this.sound.tone(cue===0?880:440,.15);}this.sound.update(this.race);
    }
    const player=this.race.player,current=player.controller.state,previous=player.previous;
    Object.assign(this.visual,current,{x:previous.x+(current.x-previous.x)*alpha,y:previous.y+(current.y-previous.y)*alpha,z:previous.z+(current.z-previous.z)*alpha,heading:previous.heading+(current.heading-previous.heading)*alpha});
    const moving=this.state==='racing'||this.state==='finished';this.rendering.draw(this.state==='menu'?this.menuKart:this.visual,moving?dt:0,this.state==='menu',this.input.rearView,this.input.read().steering,this.snapCamera,this.race,alpha);this.snapCamera=false;
    this.ui.update(this.race,this.course,this.state==='paused'?0:dt,this.rendering.getViewports(this.race.humans.length));this.ui.settingsPanel.deviceStatus(this.input.deviceStatus);
  };
  dispose():void{this.loadToken++;cancelAnimationFrame(this.animation);this.input.dispose();this.ui.dispose();this.sound.dispose();this.rendering.dispose();window.removeEventListener('resize',this.onResize);window.removeEventListener('blur',this.onBlur);document.removeEventListener('visibilitychange',this.onVisibility);document.removeEventListener('open-controls',this.onControls);document.removeEventListener('kart:force-item',this.onForceItem);}
}
