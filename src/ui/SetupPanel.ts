import type { Settings,VehicleBuild } from '../data/options';
import { courseCatalog } from '../tracks/course';
import { drivers,chassis,tyres,gliders,calculateStats } from '../data/content';
import type { SaveData } from '../platform/SaveStore';

const options=(parts:{id:string;name:string}[])=>parts.map((part)=>`<option value="${part.id}">${part.name}</option>`).join('');
export class SetupPanel {
  readonly root:HTMLElement;
  onChange:(settings:Settings)=>void=()=>{};onStart:()=>void=()=>{};onResumeCup:()=>void=()=>{};onAbandonCup:()=>void=()=>{};onBack:()=>void=()=>{};onPreview:(player:number)=>void=()=>{};
  private settings:Settings;
  constructor(container:HTMLElement,settings:Settings){
    this.settings=structuredClone(settings);this.root=document.createElement('section');this.root.id='setup';this.root.className='release-panel';this.root.hidden=true;
    const garage=(index:number)=>`<fieldset id="garage-p${index+1}" class="garage-card"><legend>PLAYER ${index+1} · DRIVER & VEHICLE</legend><div class="garage-fields"><label for="driver-p${index+1}">Player ${index+1} driver</label><select id="driver-p${index+1}" data-player="${index}" data-part="driver">${options(drivers.map((driver)=>({...driver,name:`${driver.name} · ${driver.weight}`})))}</select><label for="chassis-p${index+1}">Player ${index+1} chassis</label><select id="chassis-p${index+1}" data-player="${index}" data-part="chassis">${options(chassis)}</select><label for="tyres-p${index+1}">Player ${index+1} tyres</label><select id="tyres-p${index+1}" data-player="${index}" data-part="tyres">${options(tyres)}</select><label for="glider-p${index+1}">Player ${index+1} glider</label><select id="glider-p${index+1}" data-player="${index}" data-part="glider">${options(gliders)}</select></div><div id="stats-p${index+1}" class="stats-list"></div><button type="button" class="text-button" data-preview="${index}">Preview Player ${index+1} ride ↗</button></fieldset>`;
    this.root.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">YOUR NEXT RACING LINE</span><h1>Make it yours.</h1></div><button class="quiet-button" id="setup-back">Back</button></div>
      <div class="setup-options"><label for="mode-select">Mode<select id="mode-select" data-field="mode"><option value="versus">Versus</option><option value="grand-prix">Grand Prix</option><option value="time-trial">Time Trial</option></select></label><label for="players-select">Players<select id="players-select" data-field="players"><option value="1">One player</option><option value="2">Two-player split screen</option></select></label><label for="speed-select">Speed class<select id="speed-select" data-field="speed"><option>50cc</option><option>100cc</option><option>150cc</option><option>200cc</option></select></label><label for="difficulty-select">AI difficulty<select id="difficulty-select" data-field="difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label><label for="laps-select">Laps<select id="laps-select" data-field="laps"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label for="items-select">Items<select id="items-select" data-field="items"><option value="all">All eight items</option><option value="basic">Three classic items</option><option value="none">No item boxes</option></select></label></div>
      <div class="setup-checks"><label><input id="mirror-select" type="checkbox" data-field="mirrored"> Mirrored course</label><label><input id="ghost-select" type="checkbox" data-field="ghost"> Local Time Trial ghost</label></div>
      <p id="mode-explanation" class="panel-note"></p><p id="local-best" class="local-best"></p>
      <div class="course-grid" role="group" aria-label="Course selection">${courseCatalog.map((course)=>`<button type="button" class="course-card" data-course="${course.id}"><span class="course-symbol" style="color:${course.color}">↝</span><strong>${course.name}</strong><span>${course.description}</span></button>`).join('')}</div>
      <div class="garage-grid">${garage(0)}${garage(1)}</div><details class="stats-formula"><summary>How vehicle stats work</summary><p>Each stat = clamp(1 + driver + chassis + tyres + glider modifiers, 0.75, 1.30). These multipliers change physical speed, acceleration, steering, grip and drift charge. Sail gliders provide more lift; Delta wings trade some lift for speed.</p></details>
      <p id="setup-progress" class="panel-note"></p><div id="cup-resume" class="cup-resume" hidden><p id="cup-description"></p><button class="secondary-button" id="resume-cup">Resume cup</button><button class="text-button" id="abandon-cup">Abandon saved cup</button></div>
      <button class="primary-button" id="start">Start race <span>↗</span></button>`;
    container.append(this.root);
    this.root.addEventListener('change',(event)=>{
      const target=event.target as HTMLSelectElement|HTMLInputElement;if(target.dataset.part){const index=Number(target.dataset.player) as 0|1;this.settings.builds[index][target.dataset.part as keyof VehicleBuild]=target.value;}
      else if(target.dataset.field){const key=target.dataset.field as keyof Settings;const value=target instanceof HTMLInputElement&&target.type==='checkbox'?target.checked:['players','laps'].includes(key)?Number(target.value):target.value;Object.assign(this.settings,{[key]:value});
        if(key==='mode'&&this.settings.mode==='time-trial'){this.settings.players=1;this.settings.laps=3;this.settings.items='none';}
        if(key==='mode'&&this.settings.mode==='grand-prix'){this.settings.laps=3;this.settings.items='all';}
      }
      this.onChange(structuredClone(this.settings));
    });
    this.root.addEventListener('click',(event)=>{const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;if(target.dataset.course){this.settings.course=target.dataset.course as Settings['course'];this.onChange(structuredClone(this.settings));}if(target.dataset.preview)this.onPreview(Number(target.dataset.preview));});
    this.root.querySelector('#start')!.addEventListener('click',()=>this.onStart());this.root.querySelector('#setup-back')!.addEventListener('click',()=>this.onBack());this.root.querySelector('#resume-cup')!.addEventListener('click',()=>this.onResumeCup());this.root.querySelector('#abandon-cup')!.addEventListener('click',()=>this.onAbandonCup());
  }
  render(data:SaveData):void{
    this.settings=structuredClone(data.settings);
    for(const element of this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-field]')){const value=this.settings[element.dataset.field as keyof Settings];if(element instanceof HTMLInputElement&&element.type==='checkbox')element.checked=Boolean(value);else element.value=String(value);}
    const trial=this.settings.mode==='time-trial',cup=this.settings.mode==='grand-prix';
    for(const id of['laps-select','items-select'])this.root.querySelector<HTMLSelectElement>(`#${id}`)!.disabled=trial||cup;
    this.root.querySelector<HTMLSelectElement>('#players-select')!.disabled=trial;this.root.querySelector<HTMLSelectElement>('#difficulty-select')!.disabled=trial;
    this.root.querySelector('#mode-explanation')!.textContent=trial?'Single player. No opponents or random item draws; exactly three boosts. Best runs and ghosts stay on this browser and device.':cup?'Four courses in order, three laps each, twelve racers. Score points across the cup; ties use wins, then final-race position.':'Choose course, AI difficulty, speed, lap count and items. Two players share twelve racers and pause together.';
    for(const card of this.root.querySelectorAll<HTMLButtonElement>('[data-course]')){card.classList.toggle('selected',card.dataset.course===this.settings.course);card.setAttribute('aria-pressed',String(card.dataset.course===this.settings.course));card.disabled=cup;}
    for(const select of this.root.querySelectorAll<HTMLSelectElement>('[data-part]'))select.value=this.settings.builds[Number(select.dataset.player) as 0|1][select.dataset.part as keyof VehicleBuild];
    this.root.querySelector<HTMLElement>('#garage-p2')!.hidden=this.settings.players!==2;
    for(let player=0;player<2;player++){const list=this.root.querySelector(`#stats-p${player+1}`)!,stats=calculateStats(this.settings.builds[player as 0|1]);list.replaceChildren();for(const[key,value]of Object.entries(stats)){const row=document.createElement('div'),label=document.createElement('span'),meter=document.createElement('meter'),number=document.createElement('b');label.textContent=key;meter.min=.75;meter.max=1.3;meter.value=value;meter.setAttribute('aria-label',`Player ${player+1} ${key}`);number.textContent=`${value.toFixed(2)}×`;row.append(label,meter,number);list.append(row);}}
    const active=data.cup&&!data.cup.completed;this.root.querySelector<HTMLElement>('#cup-resume')!.hidden=!active;
    if(active)this.root.querySelector('#cup-description')!.textContent=`Saved Grand Prix: race ${data.cup!.nextRace+1} / 4 · ${courseCatalog[data.cup!.nextRace]!.name}`;
    this.root.querySelector('#setup-progress')!.textContent=`Local garage coins: ${data.coins} · Badges: ${data.unlocks.length?data.unlocks.join(', ').replaceAll('-',' '):'finish a race to earn your first'}`;
    this.root.querySelector('#start')!.firstChild!.textContent=cup?'Start new cup ':trial?'Start Time Trial ':'Start race ';
  }
  setBest(text:string):void{this.root.querySelector('#local-best')!.textContent=text;}
}
