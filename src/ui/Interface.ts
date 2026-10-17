import { config } from '../data/config';
import type { CourseDefinition,RaceState,GameEvent } from '../data/types';
import type { Race } from '../gameplay/Race';
import type { Settings,ControlBindings } from '../data/options';
import type { SaveData } from '../platform/SaveStore';
import { validateSave } from '../platform/SaveStore';
import type { Viewport } from '../rendering/Renderer';
import { SetupPanel } from './SetupPanel';
import { SettingsPanel } from './SettingsPanel';
import { RaceHud } from './RaceHud';
import { courseCatalog } from '../tracks/course';
import { drivers,chassis,tyres,gliders,calculateStats } from '../data/content';
import { cupRanking } from '../gameplay/Cup';
import { formatTime,keyLabel } from './format';
export { formatTime } from './format';

export class Interface {
  readonly menu:HTMLElement;readonly hud:HTMLElement;readonly pause:HTMLElement;readonly controls:HTMLDialogElement;
  readonly setup:SetupPanel;readonly settingsPanel:SettingsPanel;readonly huds:RaceHud[];
  private data:SaveData;private state:RaceState='boot';private view='title';private settingsReturn='title';private confirmAction:(()=>void)|null=null;private messageTime=0;private lastResults:Race|null=null;
  onStart:()=>void=()=>{};onPause:()=>void=()=>{};onResume:()=>void=()=>{};onRestart:()=>void=()=>{};onMenu:()=>void=()=>{};onSound:()=>void=()=>{};
  onCourse:(short:boolean)=>void=()=>{};onSettings:(settings:Settings)=>void=()=>{};onResumeCup:()=>void=()=>{};onAbandonCup:()=>void=()=>{};onContinueCup:()=>void=()=>{};
  onReset:()=>void=()=>{};onExport:()=>void=()=>{};onImport:(json:string)=>void=()=>{};onPreview:(player:number)=>void=()=>{};onFullscreen:()=>void=()=>{};onTouch:(action:keyof ControlBindings,pressed:boolean,id:number)=>void=()=>{};
  constructor(root:HTMLElement,data:SaveData=validateSave({version:3}),status='Saved locally to this browser and device.'){
    this.data=data;
    root.innerHTML=`<div id="world"></div><div class="vignette" aria-hidden="true"></div>
      <header class="site-header"><a class="brand" href="#menu" aria-label="Return to title"><span class="brand-icon" aria-hidden="true">P<span>↗</span></span><span class="brand-name"></span></a><div class="header-right"><span class="build-tag">THE WHOLE CIRCUIT / 003</span><button class="quiet-button" id="header-settings">Settings</button><button class="quiet-button" id="sound" aria-pressed="false">Sound on</button><button class="quiet-button" id="fullscreen">Fullscreen</button><button class="quiet-button" id="open-controls">Controls ↗</button></div></header>
      <main id="menu" class="title-screen"><div class="eyebrow"><span class="live-dot"></span> FOUR COURSES. ONE GOOD TIME.</div><h1>Good turns.<br>Great <span>times.</span></h1><p class="intro">Twelve racers. Your own weekend ride.<br>Race the cup, chase a ghost, or share<br class="wide-only"> the road with a friend.</p><div class="course-picker"><div class="course-heading"><span>THE FULL CIRCUIT</span><span>03 / RELEASE</span></div><div class="course-option"><span class="course-stamp">↝</span><div><span id="title-course">Garden Circuit</span></div><span class="course-badge">THREE MODES</span></div><div class="course-details"><span>8 ORIGINAL DRIVERS</span><span>8 ITEMS</span><span>SPLIT SCREEN</span></div></div><button class="primary-button" id="choose-race">Race setup <span>↗</span></button><p class="start-note"><span class="key">W</span> accelerate · <span class="key">SPACE</span> drift · <span class="key">E</span> item</p></main>
      <aside class="scene-caption" aria-hidden="true"><span class="caption-line"></span><span>YOUR OWN WEEKEND RIDE<br><strong>Now with company.</strong></span></aside><footer class="menu-footer"><span>BUILT FOR THE JOY OF THE DRIVE.</span><span>ORIGINAL 3D PLAYGROUND / MILESTONE 03</span></footer>
      <section id="garage-preview" class="garage-preview" hidden><span class="eyebrow">THE GARAGE</span><h1>Your ride.</h1><p id="garage-description"></p><p id="garage-stats"></p><button class="primary-button" id="garage-back">Back to setup <span>↗</span></button></section>
      <section id="loading" class="modal-scrim" aria-label="Loading course" hidden><div class="modal-card"><span class="eyebrow">PREPARING YOUR PLAYGROUND</span><h2 id="loading-message">Building course…</h2><progress id="loading-progress" value="0" max="1"></progress><p id="loading-note"></p><button class="secondary-button" id="retry-load" hidden>Retry</button><button class="text-button" id="loading-menu">Return to title</button></div></section>
      <section id="pause" class="modal-scrim" aria-label="Race paused" hidden><div class="modal-card"><span class="eyebrow">A MOMENT IN THE PITS</span><h2>Take a breather.</h2><p id="pause-message">The whole race is paused.</p><button class="primary-button" id="resume">Back to the track <span>↗</span></button><button class="secondary-button" id="restart">Restart this race</button><button class="secondary-button" id="pause-settings">Settings & controls</button><button class="text-button" id="back-menu">Return to title</button></div></section>
      <section id="results" class="modal-scrim" aria-label="Race results" hidden><div class="modal-card results-card"><span class="eyebrow">EVERY TURN COUNTED.</span><h2 id="results-title">Across the line.</h2><p id="result-summary"></p><p id="result-note" role="status"></p><div id="podium" class="podium" hidden></div><table><thead><tr><th>POS</th><th>DRIVER</th><th>TIME</th><th>COINS</th></tr></thead><tbody id="result-rows"></tbody></table><details id="cup-standings" hidden><summary>Cup points and standings</summary><table><thead><tr><th>POS</th><th>DRIVER</th><th>POINTS</th><th>WINS</th></tr></thead><tbody id="cup-rows"></tbody></table></details><p class="controls-note">Finishers are locked in crossing order. DNF racers follow by validated progress. Records are local to this device.</p><button class="primary-button" id="race-again">Race again <span>↗</span></button><button class="text-button" id="results-menu">Return to title</button></div></section>
      <dialog id="controls"><div class="modal-card"><span class="eyebrow">THE DRIVER’S HANDBOOK</span><h2>Find your feet.</h2><div id="controls-list"></div><p class="controls-note">Hold drift at speed while turning: ◆ blue, ◆◆ orange, ◆◆◆ purple; release for a boost. Brake + Item launches rearward. Use a trick input just after a ramp takeoff for a landing boost. Gliders open only at marked launch ramps; pitch alters lift and yaw changes your line. F-style rescue returns to a safe validated checkpoint with a two-second hold. Collect item boxes and up to ten coins; shield bursts counter incoming strikes. Split-screen players use separate keys or gamepads and share pause. Settings offers full remapping, assists, volume and quality.</p><p class="controls-note">Gamepad: A / RT accelerate, B / LT brake, left stick steer / pitch, X or RB drift, LB item, Y rear view, Back rescue, Start pause. Touch controls appear automatically on landscape touch devices for single-player races.</p><button class="primary-button" id="close-controls">Got it <span>✓</span></button></div></dialog>
      <dialog id="confirm-action"><div class="modal-card"><h2 id="confirm-title"></h2><p id="confirm-message"></p><button class="primary-button" id="confirm-yes">Confirm</button><button class="text-button" id="confirm-no">Cancel</button></div></dialog>
      <div id="touch-controls" class="touch-controls" aria-label="Touch driving" hidden><div class="touch-left"><button data-touch="left" aria-label="Steer left">←</button><button data-touch="right" aria-label="Steer right">→</button><button data-touch="rear" aria-label="Look behind">Rear</button><button data-touch="rescue" aria-label="Rescue">Rescue</button></div><div class="touch-right"><button data-touch="pitchUp" aria-label="Glider dive">Dive</button><button data-touch="pitchDown" aria-label="Glider pull up">Lift</button><button data-touch="brake" aria-label="Brake">Brake</button><button data-touch="drift" aria-label="Drift">Drift</button><button data-touch="item" aria-label="Use item">Item</button><button class="touch-go" data-touch="throttle" aria-label="Accelerate">Go</button></div></div>
      <div id="global-message" class="global-message" role="status" hidden></div><pre id="debug" hidden></pre>`;
    document.title=config.title;root.querySelector('.brand-name')!.textContent=config.title;
    this.menu=root.querySelector('#menu')!;this.pause=root.querySelector('#pause')!;this.controls=root.querySelector('#controls')!;
    this.setup=new SetupPanel(root,data.settings);this.settingsPanel=new SettingsPanel(root,data.settings);this.huds=[new RaceHud(root,0),new RaceHud(root,1)];this.hud=this.huds[0]!.root;
    const pauseButton=document.createElement('button');pauseButton.id='header-pause';pauseButton.className='quiet-button';pauseButton.textContent='Pause';root.querySelector('.header-right')!.prepend(pauseButton);
    const click=(id:string,handler:()=>void)=>root.querySelector(id)!.addEventListener('click',handler);
    click('#header-pause',()=>this.onPause());
    click('#choose-race',()=>this.showSetup());click('#header-settings',()=>this.openSettings());click('#pause-settings',()=>this.openSettings());click('#sound',()=>this.onSound());click('#fullscreen',()=>this.onFullscreen());
    click('#open-controls',()=>{this.controls.showModal();document.dispatchEvent(new Event('open-controls'));});click('#close-controls',()=>this.controls.close());
    click('#resume',()=>this.onResume());click('#restart',()=>this.onRestart());click('#back-menu',()=>this.onMenu());click('#results-menu',()=>this.onMenu());click('#loading-menu',()=>this.onMenu());click('#retry-load',()=>this.onRestart());
    click('#race-again',()=>this.lastResults?.options.mode==='grand-prix'?this.onContinueCup():this.onRestart());
    click('#garage-back',()=>{this.showSetup();this.onPreview(0);});
    root.querySelector('.brand')!.addEventListener('click',(event)=>{event.preventDefault();this.onMenu();});
    click('#confirm-yes',()=>{const action=this.confirmAction;(root.querySelector('#confirm-action') as HTMLDialogElement).close();this.confirmAction=null;action?.();});click('#confirm-no',()=>{(root.querySelector('#confirm-action') as HTMLDialogElement).close();this.confirmAction=null;});
    this.setup.onChange=(settings)=>this.onSettings(settings);this.setup.onStart=()=>{if(this.data.settings.mode==='grand-prix'&&this.data.cup&&!this.data.cup.completed)this.confirm('Start a new cup?','This replaces your unfinished local cup. Your settings and other records remain.',()=>this.onStart());else this.onStart();};
    this.setup.onBack=()=>this.showTitle();this.setup.onResumeCup=()=>this.onResumeCup();this.setup.onAbandonCup=()=>this.confirm('Abandon this cup?','Saved points for this unfinished cup will be cleared.',()=>this.onAbandonCup());
    this.setup.onPreview=(index)=>{this.view='garage';this.refreshVisibility();this.onPreview(index);this.showGarage(index);};
    this.settingsPanel.onChange=(settings)=>this.onSettings(settings);this.settingsPanel.onBack=()=>{this.view=this.settingsReturn;this.refreshVisibility();};
    this.settingsPanel.onReset=()=>this.confirm('Reset local progress?','Clear local coins, badges, personal bests, ghost recordings and cup progress. Control and display settings remain.',()=>this.onReset());this.settingsPanel.onExport=()=>this.onExport();this.settingsPanel.onImport=(json)=>this.onImport(json);
    const touch=root.querySelector('#touch-controls')!;touch.addEventListener('contextmenu',(event)=>event.preventDefault());
    for(const button of touch.querySelectorAll<HTMLButtonElement>('[data-touch]')){
      button.addEventListener('pointerdown',(event)=>{event.preventDefault();button.setPointerCapture(event.pointerId);this.onTouch(button.dataset.touch as keyof ControlBindings,true,event.pointerId);});
      const release=(event:PointerEvent)=>this.onTouch(button.dataset.touch as keyof ControlBindings,false,event.pointerId);button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    }
    this.setData(data,status);this.refreshVisibility();
  }
  private refreshVisibility():void{
    this.menu.hidden=this.view!=='title';this.setup.root.hidden=this.view!=='setup';this.settingsPanel.root.hidden=this.view!=='settings';
    document.querySelector<HTMLElement>('#garage-preview')!.hidden=this.view!=='garage';this.pause.hidden=!(this.state==='paused'&&this.view==='race');
    document.querySelector<HTMLElement>('#results')!.hidden=this.view!=='results';document.querySelector<HTMLElement>('#loading')!.hidden=this.view!=='loading';
    document.querySelector<HTMLElement>('.scene-caption')!.hidden=this.view!=='title';document.querySelector<HTMLElement>('.menu-footer')!.hidden=this.view!=='title';document.querySelector<HTMLElement>('.build-tag')!.hidden=this.state!=='menu';
    document.body.dataset.menu=this.view;
  }
  showTitle():void{this.view='title';this.refreshVisibility();document.querySelector<HTMLButtonElement>('#choose-race')!.focus({preventScroll:true});}
  showSetup():void{this.view='setup';this.setup.render(this.data);this.refreshVisibility();}
  private openSettings():void{document.dispatchEvent(new Event('open-controls'));this.settingsReturn=this.state==='paused'?'race':this.view;this.view='settings';this.refreshVisibility();}
  private showGarage(index:number):void{
    const build=this.data.settings.builds[index as 0|1],driver=drivers.find((entry)=>entry.id===build.driver)!;document.querySelector('#garage-description')!.textContent=`Player ${index+1} · ${driver.name} · ${chassis.find((p)=>p.id===build.chassis)!.name} / ${tyres.find((p)=>p.id===build.tyres)!.name} / ${gliders.find((p)=>p.id===build.glider)!.name}`;
    document.querySelector('#garage-stats')!.textContent=Object.entries(calculateStats(build)).map(([key,value])=>`${key} ${value.toFixed(2)}×`).join(' · ');
  }
  setData(data:SaveData,status:string):void{
    this.data=data;this.setup.render(data);this.settingsPanel.render(data,status);this.setSound(data.settings.muted||data.settings.masterVolume===0);
    document.querySelector('#title-course')!.textContent=courseCatalog.find((entry)=>entry.id===data.settings.course)!.name;
    const controls=document.querySelector('#controls-list')!;controls.replaceChildren();
    for(let i=0;i<2;i++){const title=document.createElement('h3');title.textContent=`Player ${i+1} keyboard`;const list=document.createElement('p');list.className='controls-note';const keys=data.settings.controls[i]!;list.textContent=`${keyLabel(keys.throttle)} go · ${keyLabel(keys.brake)} brake · ${keyLabel(keys.left)} / ${keyLabel(keys.right)} steer · ${keyLabel(keys.drift)} drift · ${keyLabel(keys.item)} item · ${keyLabel(keys.rear)} rear · ${keyLabel(keys.rescue)} rescue · ${keyLabel(keys.pitchUp)} / ${keyLabel(keys.pitchDown)} glider dive / lift`;controls.append(title,list);}
  }
  setState(state:RaceState):void{
    this.state=state;document.body.dataset.state=state;
    this.view=state==='menu'?'title':state==='results'?'results':state==='loading'?'loading':'race';this.refreshVisibility();
    if(state==='paused'&&!this.controls.open)document.querySelector<HTMLButtonElement>('#resume')!.focus();if(state==='results'){const title=document.querySelector<HTMLElement>('#results-title')!;title.tabIndex=-1;title.focus({preventScroll:true});document.querySelector<HTMLElement>('#results')!.scrollTop=0;}if(state==='menu')document.querySelector<HTMLButtonElement>('#choose-race')!.focus({preventScroll:true});
    if(state==='racing')(document.activeElement as HTMLElement|null)?.blur();
  }
  setCourse(course:CourseDefinition):void{for(const hud of this.huds)hud.setCourse(course);}
  setBest(text:string):void{this.setup.setBest(text);}
  setLoading(progress:number,label:string):void{document.querySelector<HTMLProgressElement>('#loading-progress')!.value=progress;document.querySelector('#loading-message')!.textContent=label;document.querySelector<HTMLElement>('#retry-load')!.hidden=true;document.querySelector('#loading-note')!.textContent='Selected course geometry, racers and local ghost data.';}
  loadFailed(message:string):void{document.querySelector('#loading-message')!.textContent='The course could not load.';document.querySelector('#loading-note')!.textContent=message;document.querySelector<HTMLElement>('#retry-load')!.hidden=false;}
  confirm(title:string,message:string,action:()=>void):void{this.confirmAction=action;document.querySelector('#confirm-title')!.textContent=title;document.querySelector('#confirm-message')!.textContent=message;(document.querySelector('#confirm-action') as HTMLDialogElement).showModal();}
  message(text:string,persistent=false):void{const element=document.querySelector<HTMLElement>('#global-message')!;element.textContent=text;element.hidden=false;this.messageTime=persistent?Infinity:6;}
  controllerDisconnected(player:number):void{document.querySelector('#pause-message')!.textContent=`Player ${player+1} controller disconnected. Reconnect it, or use Settings to choose the keyboard, then resume.`;this.message(`Player ${player+1}: controller disconnected. The shared race is paused.`,true);}
  resumed():void{document.querySelector('#pause-message')!.textContent='The whole race is paused.';if(this.messageTime===Infinity){document.querySelector<HTMLElement>('#global-message')!.hidden=true;this.messageTime=0;}}
  graphicsLost():void{
    this.message('Graphics connection lost. Reload this page to restore the course.',true);
    document.querySelector<HTMLButtonElement>('#resume')!.disabled=true;document.querySelector<HTMLButtonElement>('#restart')!.disabled=true;
    if(!document.querySelector('#graphics-reload')){const button=document.createElement('button');button.id='graphics-reload';button.className='secondary-button';button.textContent='Reload game';button.addEventListener('click',()=>location.reload());this.pause.querySelector('.modal-card')!.append(button);}
  }
  update(race:Race,_course:CourseDefinition,dt:number,views?:Viewport[]):void{
    const visible=['countdown','racing','finished','paused'].includes(this.state)&&this.view==='race';
    for(let i=0;i<this.huds.length;i++){const hud=this.huds[i]!;hud.root.hidden=!visible||i>=race.humans.length;if(i<race.humans.length){if(views?.[i])hud.layout(views[i]!,this.data.settings.hudScale,race.humans.length===2);hud.update(race,this.data.settings,dt);}}
    const touch=this.data.settings.touchControls==='on'||(this.data.settings.touchControls==='auto'&&matchMedia('(pointer:coarse)').matches);
    document.querySelector<HTMLElement>('#touch-controls')!.hidden=!visible||this.state==='paused'||race.humans.length!==1||!touch;document.body.dataset.touch=String(visible&&race.humans.length===1&&touch);
    if(this.messageTime>0&&Number.isFinite(this.messageTime)){this.messageTime-=dt;if(this.messageTime<=0)document.querySelector<HTMLElement>('#global-message')!.hidden=true;}
    const debug=document.querySelector<HTMLElement>('#debug')!;debug.hidden=!(import.meta.env.DEV&&new URLSearchParams(location.search).has('debug'));
    if(!debug.hidden){const state=race.player.controller.state;debug.textContent=`frame ${(dt*1000).toFixed(1)} ms\nspeed ${state.speed.toFixed(1)} m/s\nsurface ${state.surface}\ntraversal ${state.traversal}\ncheckpoint ${race.player.progress.nextCheckpoint}\ndrift ${state.driftStage}\nitems ${race.player.inventory.active??'-'} / ${race.player.inventory.reserve??'-'}`;}
  }
  event(event:GameEvent,race:Race):void{if(event.type==='lap'){const index=race.humans.findIndex((racer)=>racer.id===event.racerId);if(index>=0)this.huds[index]!.showLap(event.lap,event.time);}}
  showLap(lap:number,time:number):void{this.huds[0]!.showLap(lap,time);}
  clearLap():void{for(const hud of this.huds)hud.clear();document.querySelector('#pause-message')!.textContent='The whole race is paused.';}
  showResults(race:Race):void{
    document.querySelector<HTMLElement>('#results')!.scrollTop=0;
    this.lastResults=race;const rows=document.querySelector('#result-rows')!;rows.replaceChildren();
    const player=race.results.find((row)=>row.id===race.player.id)!;document.querySelector('#result-summary')!.textContent=`${player.name} finished ${player.place} / ${race.racers.length} in ${formatTime(player.time??race.time)}. ${player.coins} coins held.`;
    document.querySelector('#result-note')!.textContent='';document.querySelector('#results-title')!.textContent=race.options.mode==='time-trial'?'Your racing line.':'Across the line.';
    for(const row of race.results){const tr=document.createElement('tr');tr.dataset.racer=row.id;if(row.id.startsWith('player-'))tr.className='player-result';for(const value of[String(row.place),row.name,row.finished?formatTime(row.time!):'DNF',String(row.coins)]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}rows.append(tr);}
    const cup=race.options.mode==='grand-prix'?this.data.cup:null,standings=document.querySelector<HTMLDetailsElement>('#cup-standings')!,podium=document.querySelector<HTMLElement>('#podium')!;standings.hidden=!cup;standings.open=!!cup;podium.hidden=!cup?.completed;
    const button=document.querySelector('#race-again')!;button.firstChild!.textContent=cup?cup.completed?'Start another cup ':`Next race · ${courseCatalog[cup.nextRace]!.name} `:'Race again ';
    if(cup){const cupRows=document.querySelector('#cup-rows')!;cupRows.replaceChildren();const ranked=cupRanking(cup.standings);for(const[rowIndex,row]of ranked.entries()){const tr=document.createElement('tr');for(const value of[String(rowIndex+1),row.name,String(row.points),String(row.wins)]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}cupRows.append(tr);}if(cup.completed){document.querySelector('#results-title')!.textContent='Grand Prix complete.';podium.replaceChildren();for(const[rowIndex,row]of ranked.slice(0,3).entries()){const card=document.createElement('div');card.textContent=`${rowIndex+1} · ${row.name} · ${row.points} pts`;podium.append(card);}}}
  }
  resultNote(text:string):void{document.querySelector('#result-note')!.textContent=text;}
  setSound(muted:boolean):void{const button=document.querySelector('#sound')!;button.textContent=muted?'Sound off':'Sound on';button.setAttribute('aria-pressed',String(muted));}
  dispose():void{this.settingsPanel.dispose();}
}
