import {test,expect,type Page} from '@playwright/test';
const tick=async(page:Page,n=1)=>{for(let i=0;i<n;i++)await page.clock.fastForward(100);};
test('supplied home artwork adapts to desktop, mobile and landscape, and every mode opens a real setup',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:new Date('2026-10-18T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-18T00:00:01Z'));await page.goto('./?course=short');await tick(page);
  await expect(page.locator('.home-art')).toBeVisible();expect(await page.locator('.home-art').evaluate((img)=>(img as HTMLImageElement).naturalWidth)).toBe(1920);
  for(const [width,height,name] of [[1440,900,'desktop'],[390,844,'mobile'],[844,390,'landscape']] as const){
    await page.setViewportSize({width,height});
    for(const id of['choose-race','home-multiplayer','home-trial','home-battle']){const bounds=await page.locator(`#${id}`).boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);}
    await page.screenshot({path:`docs/screenshots/home-${name}-audit.png`});
  }
  await page.setViewportSize({width:960,height:640});
  await page.locator('#header-settings').click();await page.locator('#setting-masterVolume').press('Home');await expect(page.locator('#setting-masterVolume')).toHaveValue('0');await page.locator('#settings-back').click();await expect(page.locator('#sound')).toHaveText('Sound off');await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveText('Sound on');
  for(const[id,mode,players]of[['home-multiplayer','versus','2'],['home-trial','time-trial','1'],['home-battle','balloon-battle','1']] as const){await page.locator(`#${id}`).click();await expect(page.locator('#setup')).toBeVisible();await expect(page.locator('#mode-select')).toHaveValue(mode);await expect(page.locator('#players-select')).toHaveValue(players);await page.locator('#setup-back').click();}
  await page.locator('#choose-race').click();await expect(page.locator('#players-select')).toHaveValue('1');await page.locator('#mode-select').selectOption('time-trial');await page.locator('#start').click();
  for(let i=0;i<30&&await page.locator('body').getAttribute('data-state')!=='countdown';i++)await tick(page);await expect(page.locator('body')).toHaveAttribute('data-state','countdown');await tick(page,32);await page.keyboard.press('Escape');await page.locator('#pause-settings').click();
  const time=await page.locator('#telemetry').getAttribute('data-time');await page.keyboard.press('r');await page.keyboard.press('Escape');await tick(page,5);await expect(page.locator('#settings')).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-state','paused');expect(await page.locator('#telemetry').getAttribute('data-time')).toBe(time);
  await page.locator('.remap-details summary').click();const remap=page.getByRole('button',{name:'Change Player 1 Accelerate key',exact:true}),label=await remap.textContent();await remap.click();await page.keyboard.press('Escape');await expect(remap).toHaveText(label!);
  await remap.click();await page.keyboard.press('Control');await page.locator('#settings-back').click();await page.locator('#resume').click();await tick(page);await expect(page.locator('body')).toHaveAttribute('data-state','racing');
  const heading=await page.locator('#telemetry').getAttribute('data-heading');await page.keyboard.down('Control');await page.keyboard.down('a');await tick(page,6);await page.keyboard.up('a');await page.keyboard.up('Control');expect(Number(await page.locator('#telemetry').getAttribute('data-speed'))).toBeGreaterThan(2);expect(await page.locator('#telemetry').getAttribute('data-heading')).not.toBe(heading);expect(errors).toEqual([]);
});
