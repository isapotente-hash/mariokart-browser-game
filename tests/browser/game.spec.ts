import { expect, test, type Page } from '@playwright/test';
import { createCourse, poseAt, sampleTrack } from '../../src/tracks/course';
import type { CourseId } from '../../src/data/options';

const read=(page:Page,player=1)=>page.locator(player===1?'#telemetry':'#telemetry-p2').evaluate((element)=>({...((element as HTMLElement).dataset)}));
const advance=async(page:Page,seconds:number)=>{for(let i=0;i<Math.round(seconds*10);i++)await page.clock.fastForward(100);};
async function boot(page:Page){
  await page.clock.install({time:new Date('2026-10-18T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-18T00:00:01Z'));
  await page.goto('./?course=short');await advance(page,.1);
  await expect(page.locator('#choose-race')).toBeVisible();
  await page.locator('#header-settings').click({force:true});await page.locator('#quality-select').selectOption('low');await page.locator('#settings-back').click({force:true});
}
async function loaded(page:Page){for(let i=0;i<15;i++){await advance(page,.1);if(await page.locator('body').getAttribute('data-state')==='countdown'){await advance(page,.1);return;}}await expect(page.locator('body')).toHaveAttribute('data-state','countdown');}
function errorsOn(page:Page){const errors:string[]=[];page.on('pageerror',(error)=>errors.push(error.message));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});page.on('response',(response)=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});return errors;}
async function drive(page:Page,id:CourseId,laps:number,shot?:string){
  const course=createCourse(id,false,true);const held=new Set<string>();let captured=false;const traversals=new Set<string>();
  const key=async(name:string,on:boolean)=>{if(held.has(name)!==on){await page.keyboard[on?'down':'up'](name);on?held.add(name):held.delete(name);}};
  for(let frame=0;frame<2000;frame++){
    const phase=await page.locator('body').getAttribute('data-state');if(phase==='results')break;
    const state=await read(page),kart={x:Number(state.x),y:Number(state.y),z:Number(state.z),heading:Number(state.heading),speed:Number(state.speed)};
    const road=sampleTrack(course,kart),target=poseAt(course,road.progress+1.8+Math.abs(kart.speed)*.34,road.route);
    const heading=Math.atan2(target.x-kart.x,target.z-kart.z),error=Math.atan2(Math.sin(heading-kart.heading),Math.cos(heading-kart.heading));
    await key('a',error>.05);await key('d',error<-.05);await key('w',kart.speed<7.5);await key('s',kart.speed>8.2);
        if(state.traversal==='gliding'){
      const zone=course.launches.find((zone)=>zone.glider)!,landing=poseAt(course,zone.landing),remaining=Math.max(2,zone.landing-road.progress);
      const desired=(landing.y!-kart.y)/Math.max(.5,remaining/Math.max(4,kart.speed));const pitch=(desired-Number(state.vy))*.14;
      await key('ArrowUp',pitch<-.12);await key('ArrowDown',pitch>.12);
    }else{await key('ArrowUp',false);await key('ArrowDown',false);}
    if(frame%12===0&&state.active)await page.keyboard.press('e');
    if(shot&&['underwater','anti-gravity','gliding'].includes(state.traversal!)&&!traversals.has(state.traversal!)){traversals.add(state.traversal!);await page.screenshot({path:`docs/screenshots/${shot}-${state.traversal}.png`});}
    await advance(page,.1);
    if(shot&&!captured&&Number(state.time)>8){await page.screenshot({path:`docs/screenshots/${shot}.png`});captured=true;}
    if(frame%200===0)console.log(`${id} ${state.time}s lap${state.laps}/${laps} gate${state.checkpoint} rescues${state.rescues}`);
  }
  for(const name of held)await page.keyboard.up(name);
  await expect(page.locator('body')).toHaveAttribute('data-state','results');expect((await read(page)).laps).toBe(String(laps));
}

test('production menus, real vehicle selection, settings persistence and independent split-screen controls',async({page})=>{
  const errors=errorsOn(page);await boot(page);await page.screenshot({path:'docs/screenshots/title-m3.png'});
  await page.locator('#choose-race').click({force:true});await expect(page.locator('[data-course]')).toHaveCount(4);await expect(page.locator('#driver-p1 option')).toHaveCount(8);
  await page.locator('#players-select').selectOption('2');await page.locator('#driver-p1').selectOption('ash');await page.locator('#chassis-p1').selectOption('comet');await page.locator('#tyres-p1').selectOption('slick');await page.locator('#glider-p1').selectOption('wing');
  await page.locator('[data-course="harbour-run"]').click({force:true});await expect(page.locator('[data-course="harbour-run"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-course="garden-circuit"]').click({force:true});await page.screenshot({path:'docs/screenshots/setup-m3.png'});
  await page.locator('[data-preview="0"]').click({force:true});await expect(page.locator('#garage-description')).toContainText('Ash');await page.screenshot({path:'docs/screenshots/garage-m3.png'});await page.locator('#garage-back').click({force:true});
  await page.locator('#header-settings').click({force:true});await page.locator('#split-select').selectOption('side');await page.locator('[data-setting="muted"]').check({force:true});await page.screenshot({path:'docs/screenshots/settings-m3.png'});await page.locator('#settings-back').click({force:true});
  await page.setViewportSize({width:960,height:640});await page.locator('#start').click({force:true});await loaded(page);expect((await read(page)).racers).toBe('12');expect((await read(page)).aiCount).toBe('10');expect((await read(page)).driver).toBe('ash');
  const start=await read(page);await page.keyboard.down('w');await advance(page,1);await page.keyboard.up('w');expect((await read(page)).x).toBe(start.x);expect((await read(page)).time).toBe('0');
  await advance(page,2.2);await page.keyboard.down('w');await page.keyboard.down('o');await advance(page,.8);await page.keyboard.up('w');await page.keyboard.up('o');
  expect((await read(page)).rear).toBe('false');expect((await read(page,2)).rear).toBe('true');expect(Number((await read(page)).speed)).toBeGreaterThan(4);await page.screenshot({path:'docs/screenshots/split-side-m3.png'});
  await page.keyboard.press('Escape');await advance(page,.1);const paused=await read(page);await advance(page,1);expect((await read(page)).time).toBe(paused.time);
  await page.locator('#pause-settings').click({force:true});await page.locator('#split-select').selectOption('stacked');await page.locator('#settings-back').click({force:true});await page.locator('#resume').click({force:true});await advance(page,.1);await page.screenshot({path:'docs/screenshots/split-stacked-m3.png'});
  const bounds=await page.locator('#hud-p2').boundingBox();expect(bounds!.y).toBe(320);await page.keyboard.press('Escape');await page.locator('#restart').click({force:true});await loaded(page);expect((await read(page)).time).toBe('0');expect((await read(page,2)).time).toBe('0');await expect(page.locator('canvas')).toHaveCount(1);
  await page.reload();await advance(page,.1);await page.locator('#header-settings').click({force:true});await expect(page.locator('#quality-select')).toHaveValue('low');await expect(page.locator('#split-select')).toHaveValue('stacked');await expect(page.locator('[data-setting="muted"]')).toBeChecked();expect(errors).toEqual([]);
});

test('production Time Trial completes three valid laps, persists best and recorded ghost, and restarts',async({page})=>{
  test.setTimeout(360000);const errors=errorsOn(page);await boot(page);await page.setViewportSize({width:800,height:600});await page.locator('#choose-race').click({force:true});await page.locator('#mode-select').selectOption('time-trial');await expect(page.locator('#items-select')).toHaveValue('none');await expect(page.locator('#players-select')).toBeDisabled();
  await page.locator('#start').click({force:true});await loaded(page);expect((await read(page)).racers).toBe('1');expect((await read(page)).trialBoosts).toBe('3');await advance(page,3.2);
  await drive(page,'garden-circuit',3,'trial-m3');await expect(page.locator('#result-rows tr')).toHaveCount(1);await expect(page.locator('#result-note')).toContainText('Ghost saved locally');await page.screenshot({path:'docs/screenshots/results-trial-m3.png'});
  const bests=await page.evaluate(()=>JSON.parse(localStorage.getItem('pocket-circuit-save')!).bests);expect(Object.keys(bests)).toHaveLength(1);
  await page.locator('#race-again').click({force:true});await loaded(page);expect((await read(page)).trialBoosts).toBe('3');expect((await read(page)).time).toBe('0');await expect(page.locator('#global-message')).toContainText('Local ghost loaded');
  await page.keyboard.press('Escape');await page.locator('#back-menu').click({force:true});await page.reload();await advance(page,.1);await page.locator('#choose-race').click({force:true});await expect(page.locator('#local-best')).toContainText('Local personal best');expect(errors).toEqual([]);
});



test('production Grand Prix drives all four courses, resumes after reload, scores standings and shows the final podium',async({page})=>{
  test.setTimeout(1800000);const errors=errorsOn(page);await boot(page);await page.setViewportSize({width:640,height:480});await page.locator('#choose-race').click({force:true});await page.locator('#mode-select').selectOption('grand-prix');
  await expect(page.locator('#laps-select')).toBeDisabled();await page.locator('#start').click({force:true});await loaded(page);await advance(page,3.2);
  const ids:CourseId[]=['garden-circuit','harbour-run','sky-foundry','starlight-causeway'];
  for(const[index,id]of ids.entries()){
    await drive(page,id,3,`cup-${id}-m3`);await expect(page.locator('#result-rows tr')).toHaveCount(12);if(!await page.locator('#cup-standings').evaluate((node)=>(node as HTMLDetailsElement).open))await page.locator('#cup-standings summary').click({force:true});await expect(page.locator('#cup-rows tr')).toHaveCount(12);await expect(page.locator('#cup-rows tr').first()).toBeVisible();
    const cup=await page.evaluate(()=>JSON.parse(localStorage.getItem('pocket-circuit-save')!).cup);expect(cup.nextRace).toBe(index+1);expect(cup.standings.reduce((sum:number,row:{points:number})=>sum+row.points,0)).toBe(82*(index+1));await page.screenshot({path:`docs/screenshots/cup-results-${index+1}-m3.png`});
    if(index===0){await page.locator('#results-menu').click({force:true});await page.reload();await advance(page,.1);await page.locator('#choose-race').click({force:true});await expect(page.locator('#cup-description')).toContainText('Harbour Run');await page.locator('#resume-cup').click({force:true});}
    else if(index<3)await page.locator('#race-again').click({force:true});
    if(index<3){await loaded(page);await advance(page,3.2);}
  }
  await expect(page.locator('#results-title')).toHaveText('Grand Prix complete.');await expect(page.locator('#podium>div')).toHaveCount(3);await page.screenshot({path:'docs/screenshots/podium-m3.png'});expect(errors).toEqual([]);
});
