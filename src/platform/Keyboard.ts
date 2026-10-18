import type { DrivingInput } from '../data/types';
import { defaultSettings } from '../data/options';
import type { Settings,ControlBindings } from '../data/options';

type Action=keyof ControlBindings;
export class Keyboard {
  private keys=new Set<string>();private requests=[false,false];private rescues=[false,false];private rearRequests=[false,false];
  private touchKeys=new Map<number,Action>();private padInputs:DrivingInput[]=[];private padButtons=new Map<number,Set<number>>();private assigned=[-1,-1];
  private settings:Settings=defaultSettings();active=false;driving=true;
  onPause:()=>void=()=>{};onRestart:()=>void=()=>{};onDisconnect:(player:number)=>void=()=>{};
  configure(settings:Settings):void{this.settings=structuredClone(settings);this.clear();}
  private readonly down=(event:KeyboardEvent)=>{
    if(!this.active||document.querySelector('dialog[open]')||event.metaKey||event.altKey)return;
    if(document.querySelector('#settings:not([hidden])'))return;
    const bound=Object.values(this.settings.controls.slice(0,this.settings.players)).flatMap(mapping=>Object.values(mapping));
    if(event.ctrlKey&&!bound.some(code=>code==='ControlLeft'||code==='ControlRight'))return;
    if(event.code==='Escape'){if(!event.repeat)this.onPause();return;}if(event.code==='KeyR'){event.preventDefault();if(!event.repeat)this.onRestart();return;}if(!this.driving)return;
    if(bound.includes(event.code)||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();this.keys.add(event.code);
    if(!event.repeat)for(let i=0;i<this.settings.players;i++){
      if(event.code===this.settings.controls[i]!.item){this.requests[i]=true;this.rearRequests[i]=this.read(i).brake;}
      if(event.code===this.settings.controls[i]!.rescue)this.rescues[i]=true;
    }
  };
  private readonly up=(event:KeyboardEvent)=>{this.keys.delete(event.code);};private readonly blur=()=>this.clear();
  constructor(){window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur);}
  poll():void{
    let pads:readonly(Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{pads=[];}
    const available=Array.from(pads).filter((pad):pad is Gamepad=>!!pad&&pad.connected),claimed=new Set<number>();
    for(let player=0;player<2;player++){
      const preferred=player<this.settings.players&&this.settings.devices[player]==='gamepad',previous=this.assigned[player]!;
      const reserved=new Set(this.assigned.filter((index,other)=>other!==player&&other<this.settings.players&&this.settings.devices[other]==='gamepad'&&available.some(pad=>pad.index===index)));
      const pad=preferred?(previous>=0?available.find(pad=>pad.index===previous):available.find(pad=>!claimed.has(pad.index)&&!reserved.has(pad.index))):undefined;
      if(pad)claimed.add(pad.index);
      this.assigned[player]=pad?.index??-1;
      if(this.active&&preferred&&previous>=0&&previous!==(pad?.index??-1))this.onDisconnect(player);
      if(!pad){this.padInputs[player]={throttle:false,brake:false,steering:0};continue;}
      const old=this.padButtons.get(pad.index)??new Set<number>(),pressed=new Set<number>();pad.buttons.forEach((button,i)=>{if(button.pressed||button.value>.5)pressed.add(i);});
      const edge=(index:number)=>pressed.has(index)&&!old.has(index);this.padButtons.set(pad.index,pressed);
      const settingsOpen=!!document.querySelector('#settings:not([hidden])');
      if(this.active&&!settingsOpen&&edge(9))this.onPause();
      if(this.active&&this.driving){if(edge(4)){this.requests[player]=true;this.rearRequests[player]=pressed.has(6)||pressed.has(1);}if(edge(8))this.rescues[player]=true;}
      const axis=Math.abs(pad.axes[0]??0)<.15?0:pad.axes[0]??0;
      this.padInputs[player]={throttle:pressed.has(0)||pressed.has(7),brake:pressed.has(1)||pressed.has(6),steering:-axis,drift:pressed.has(2)||pressed.has(5),rearView:pressed.has(3),pitch:pad.axes[1]??0,rearward:pressed.has(6)||pressed.has(1)};
    }
  }
  touch(action:Action,pressed:boolean,id:number):void{
    if(!this.active||!this.driving)return;
    if(pressed){this.touchKeys.set(id,action);if(action==='item'){this.requests[0]=true;this.rearRequests[0]=this.read(0).brake;}if(action==='rescue')this.rescues[0]=true;}
    else this.touchKeys.delete(id);
  }
  read(index=0):DrivingInput{
    const mapping=this.settings.controls[index]!,pad=this.padInputs[index],touch=index===0?new Set(this.touchKeys.values()):new Set<Action>();
    const held=(action:Action)=>this.keys.has(mapping[action])||touch.has(action);
    const alias=(code:string)=>index===0&&!(this.settings.players===2&&Object.values(this.settings.controls[1]).includes(code))&&this.keys.has(code);
    const up=alias('ArrowUp'),down=alias('ArrowDown');
    const left=held('left')||alias('ArrowLeft'),right=held('right')||alias('ArrowRight');
    const throttle=held('throttle')||up||!!pad?.throttle,brake=held('brake')||down||!!pad?.brake;
    return{throttle,brake,steering:Math.max(-1,Math.min(1,Number(left)-Number(right)+(pad?.steering??0))),drift:held('drift')||!!pad?.drift,rearward:brake,pitch:Math.max(-1,Math.min(1,Number(held('pitchDown'))-Number(held('pitchUp'))+(pad?.pitch??0))),rearView:held('rear')||!!pad?.rearView};
  }
  consume(index=0):DrivingInput{const result={...this.read(index),useItem:this.requests[index],rescue:this.rescues[index],rearward:this.rearRequests[index]||this.read(index).rearward};this.requests[index]=false;this.rescues[index]=false;this.rearRequests[index]=false;return result;}
  consumeAll():DrivingInput[]{return Array.from({length:this.settings.players},(_,index)=>this.consume(index));}
  get rearView():boolean{return!!this.read().rearView;}
  get deviceStatus():string{return this.settings.devices.map((device,index)=>`P${index+1}: ${device==='keyboard'?'keyboard':this.assigned[index]!>=0?`gamepad ${this.assigned[index]!+1}`:'waiting for gamepad (keyboard available)'}`).join(' · ');}
  clear():void{this.keys.clear();this.touchKeys.clear();this.requests=[false,false];this.rescues=[false,false];this.rearRequests=[false,false];}
  dispose():void{window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);this.clear();}
}
