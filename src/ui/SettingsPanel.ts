import type { Settings,ControlBindings } from '../data/options';
import type { SaveData } from '../platform/SaveStore';
import { keyLabel } from './format';

const actions:Record<keyof ControlBindings,string>={throttle:'Accelerate',brake:'Brake / reverse',left:'Steer left',right:'Steer right',drift:'Hop / drift',item:'Use item',rear:'Rear view',rescue:'Rescue',pitchUp:'Glider dive',pitchDown:'Glider pull up'};
export class SettingsPanel {
  readonly root:HTMLElement;private settings:Settings;private waiting:{player:0|1;action:keyof ControlBindings}|null=null;
  onChange:(settings:Settings)=>void=()=>{};onBack:()=>void=()=>{};onReset:()=>void=()=>{};onExport:()=>void=()=>{};onImport:(json:string)=>void=()=>{};
  constructor(container:HTMLElement,settings:Settings){
    this.settings=structuredClone(settings);this.root=document.createElement('section');this.root.id='settings';this.root.className='release-panel settings-panel';this.root.hidden=true;
    const range=(field:string,label:string,min:number,max:number,step:number)=>`<label for="setting-${field}">${label}<input id="setting-${field}" data-setting="${field}" type="range" min="${min}" max="${max}" step="${step}"><output id="value-${field}"></output></label>`;
    const remap=(player:number)=>`<fieldset class="binding-card"><legend>PLAYER ${player+1} KEYBOARD</legend>${Object.entries(actions).map(([action,label])=>`<div><span>${label}</span><button type="button" class="key-binding" data-player="${player}" data-action="${action}" aria-label="Change Player ${player+1} ${label} key"></button></div>`).join('')}</fieldset>`;
    this.root.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">YOUR OWN PIT CREW</span><h1>Settings.</h1></div><button class="quiet-button" id="settings-back">Back</button></div>
      <div class="settings-grid"><fieldset><legend>DISPLAY</legend><label for="quality-select">Graphics quality<select id="quality-select" data-setting="quality"><option value="low">Low · 1× pixels, no shadows</option><option value="medium">Medium · 1.5× pixels, soft shadows</option><option value="high">High · 2× pixels, more scenery</option></select></label><label for="split-select">Split-screen layout<select id="split-select" data-setting="split"><option value="auto">Automatic</option><option value="side">Side by side</option><option value="stacked">Stacked</option></select></label><label><input type="checkbox" data-setting="reducedMotion"> Reduced camera motion</label>${range('hudScale','HUD size',.8,1.3,.1)}</fieldset>
      <fieldset><legend>AUDIO</legend>${range('masterVolume','Master volume',0,1,.05)}${range('musicVolume','Music volume',0,1,.05)}${range('effectsVolume','Effects volume',0,1,.05)}<label><input type="checkbox" data-setting="muted"> Mute all sound</label><p>Original procedural music, engine and effects. Audio starts after your first explicit start action.</p></fieldset>
      <fieldset><legend>DRIVING ASSISTS</legend><label><input type="checkbox" data-setting="autoAccelerate"> Auto-acceleration</label><label><input type="checkbox" data-setting="steeringAssist"> Gentle edge steering assist</label><p>Assists apply to the next race and never award checkpoint progress. Rearward item launch uses Brake + Item.</p></fieldset>
      <fieldset><legend>INPUT</legend><label for="device-p1">Player 1 input<select id="device-p1" data-device="0"><option value="keyboard">Keyboard</option><option value="gamepad">First gamepad</option></select></label><label for="device-p2">Player 2 input<select id="device-p2" data-device="1"><option value="keyboard">Second keyboard layout</option><option value="gamepad">Next available gamepad</option></select></label><label for="touch-select">Touch driving<select id="touch-select" data-setting="touchControls"><option value="auto">Automatic on touch devices</option><option value="on">Show single-player touch controls</option><option value="off">Hide touch controls</option></select></label><p id="device-status"></p><p>Two gamepads, keyboard + gamepad, or two keyboard layouts. Touch driving supports one landscape viewport.</p></fieldset></div>
      <details class="remap-details"><summary>Remap keyboard controls</summary><p>Select an action, then press a key. Escape cancels. Escape and R remain common pause and restart commands. Keyboard rollover may limit two players on one keyboard.</p><div class="binding-grid">${remap(0)}${remap(1)}</div><p id="remap-status" role="status"></p></details>
      <fieldset class="save-card"><legend>LOCAL DATA</legend><p id="storage-status" role="status"></p><p id="save-progress"></p><div class="save-actions"><button class="secondary-button" id="export-save">Export progress JSON</button><label class="secondary-button file-button">Import progress JSON<input id="import-save" type="file" accept="application/json,.json"></label><button class="text-button" id="reset-progress">Reset local progress…</button></div><p>Settings, badges, coins, personal bests, cup progress and ghosts stay on this browser and device. JSON exports include small save data; ghost recordings remain in the local ghost database.</p></fieldset>`;
    container.append(this.root);
    this.root.addEventListener('change',(event)=>this.change(event));this.root.addEventListener('input',(event)=>{if((event.target as HTMLInputElement).type==='range')this.change(event);});
    this.root.querySelector('#settings-back')!.addEventListener('click',()=>{this.cancel();this.onBack();});this.root.querySelector('#reset-progress')!.addEventListener('click',()=>this.onReset());this.root.querySelector('#export-save')!.addEventListener('click',()=>this.onExport());
    this.root.querySelector<HTMLInputElement>('#import-save')!.addEventListener('change',async(event)=>{const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>1024*1024){this.status('The save file is too large. Choose an exported progress JSON file.');return;}try{this.onImport(await file.text());}catch{this.status('The selected save file could not be read.');}(event.target as HTMLInputElement).value='';});
    this.root.addEventListener('click',(event)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!button)return;this.waiting={player:Number(button.dataset.player) as 0|1,action:button.dataset.action as keyof ControlBindings};button.textContent='Press a key…';window.addEventListener('keydown',this.capture,true);});
  }
  private change(event:Event):void{
    const input=event.target as HTMLInputElement|HTMLSelectElement;
    if(input.dataset.device){this.settings.devices[Number(input.dataset.device) as 0|1]=input.value as 'keyboard'|'gamepad';}
    else if(input.dataset.setting){const key=input.dataset.setting,value=input instanceof HTMLInputElement&&input.type==='checkbox'?input.checked:input instanceof HTMLInputElement&&input.type==='range'?Number(input.value):input.value;Object.assign(this.settings,{[key]:value});}
    else return;
    this.onChange(structuredClone(this.settings));
  }
  private readonly capture=(event:KeyboardEvent)=>{
    if(!this.waiting)return;event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){this.cancel();this.status('Key change cancelled.');return;}
    const {player,action}=this.waiting;
    if(event.code==='KeyR'||!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right))$/.test(event.code)){this.status('Choose a letter, digit, arrow, Space, Shift or Control; R and Escape are shared commands.');return;}
    const other=this.settings.controls[player===0?1:0];
    if(Object.values(other).includes(event.code)){this.status('That key belongs to the other player. Choose a distinct key.');return;}
    const mapping=this.settings.controls[player],duplicate=(Object.keys(mapping) as (keyof ControlBindings)[]).find((key)=>mapping[key]===event.code);
    if(duplicate)mapping[duplicate]=mapping[action];mapping[action]=event.code;this.cancel();this.onChange(structuredClone(this.settings));this.status(`Player ${player+1} ${actions[action]} is now ${keyLabel(event.code)}.`);
  };
  cancel():void{if(this.waiting){const{player,action}=this.waiting;const button=this.root.querySelector<HTMLButtonElement>(`[data-player="${player}"][data-action="${action}"]`);if(button)button.textContent=keyLabel(this.settings.controls[player][action]);}this.waiting=null;window.removeEventListener('keydown',this.capture,true);}
  status(text:string):void{this.root.querySelector('#remap-status')!.textContent=text;}
  render(data:SaveData,status:string):void{
    this.settings=structuredClone(data.settings);
    for(const input of this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]')){const value=this.settings[input.dataset.setting as keyof Settings];if(input instanceof HTMLInputElement&&input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value);const output=this.root.querySelector(`#value-${input.dataset.setting}`);if(output)output.textContent=input.dataset.setting==='hudScale'?`${Math.round(Number(value)*100)}%`:`${Math.round(Number(value)*100)}%`;}
    for(const select of this.root.querySelectorAll<HTMLSelectElement>('[data-device]'))select.value=this.settings.devices[Number(select.dataset.device) as 0|1];
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.textContent=keyLabel(this.settings.controls[Number(button.dataset.player) as 0|1][button.dataset.action as keyof ControlBindings]);
    this.root.querySelector('#storage-status')!.textContent=status;this.root.querySelector('#save-progress')!.textContent=`${data.coins} garage coins · ${data.unlocks.length} earned badges · ${Object.keys(data.bests).length} personal bests${data.cup&&!data.cup.completed?` · Cup race ${data.cup.nextRace+1} / 4`:''}`;
  }
  deviceStatus(text:string):void{this.root.querySelector('#device-status')!.textContent=text;}
  dispose():void{this.cancel();}
}
