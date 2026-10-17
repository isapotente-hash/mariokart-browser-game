import test from 'node:test';
import assert from 'node:assert/strict';
import { Keyboard } from '../src/platform/Keyboard';
import { defaultSettings } from '../src/data/options';

test('keyboard remapping, multi-touch and independent gamepads share no driving actions; disconnect pauses assignment',()=>{
  const windowMock=new EventTarget();Object.defineProperty(globalThis,'window',{value:windowMock,configurable:true});Object.defineProperty(globalThis,'document',{value:{querySelector:()=>null},configurable:true});
  let pads:any[]=[];Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>pads},configurable:true});
  const input=new Keyboard(),settings=defaultSettings();settings.players=2;input.configure(settings);input.active=true;
  const key=(code:string,down=true)=>{const event=new Event(down?'keydown':'keyup',{cancelable:true});Object.assign(event,{code,repeat:false,ctrlKey:false,metaKey:false,altKey:false});windowMock.dispatchEvent(event);};
  key('KeyW');assert.equal(input.read(0).throttle,true);assert.equal(input.read(1).throttle,false);key('KeyW',false);key('KeyI');assert.equal(input.read(0).throttle,false);assert.equal(input.read(1).throttle,true);key('KeyI',false);
  key('KeyE');assert.equal(input.consume(0).useItem,true);assert.equal(input.consume(0).useItem,false);assert.equal(input.consume(1).useItem,false);
  settings.controls[1].left='ArrowLeft';input.configure(settings);key('ArrowLeft');assert.equal(input.read(1).steering,1);assert.equal(input.read(0).steering,0);key('ArrowLeft',false);
  input.touch('throttle',true,10);input.touch('left',true,11);assert.equal(input.read(0).throttle,true);assert.equal(input.read(0).steering,1);input.touch('throttle',false,10);assert.equal(input.read(0).throttle,false);assert.equal(input.read(0).steering,1);input.clear();assert.equal(input.read(0).steering,0);
  settings.devices=['gamepad','gamepad'];input.configure(settings);const pad=(index:number)=>({index,connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});pads=[pad(0),pad(1)];pads[0].buttons[7].pressed=true;pads[1].axes[0]=.8;pads[1].buttons[3].pressed=true;input.poll();assert.equal(input.read(0).throttle,true);assert.equal(input.read(1).throttle,false);assert.equal(input.read(0).rearView,false);assert.equal(input.read(1).rearView,true);assert.equal(input.read(1).steering,-.8);
  let disconnects=0;input.onDisconnect=()=>disconnects++;pads=[null,pads[1]];input.poll();assert.ok(disconnects>0);input.dispose();
});
