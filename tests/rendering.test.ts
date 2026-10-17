import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKart } from '../src/rendering/kart';
import { disposeGroup } from '../src/rendering/resources';
import { defaultSettings } from '../src/data/options';
import { drivers } from '../src/data/content';

test('batched kart geometry preserves every driver, tyre silhouette and independently animated wheel assembly',()=>{
  for(const driver of drivers)for(const tyres of ['standard','grip','slick']){
    const kart=createKart({...defaultSettings().builds[0],driver:driver.id,tyres,chassis:'comet'});
    assert.equal(kart.wheels.length,4);assert.equal(kart.rollers.length,4);assert.equal(kart.frontWheels.length,2);
    let meshes=0;kart.root.traverse((object)=>{if(object instanceof THREE.Mesh){meshes++;const attribute=object.geometry.getAttribute('position');for(let i=0;i<attribute.array.length;i++)assert.ok(Number.isFinite(attribute.array[i]));}});
    assert.ok(meshes<=20,`${driver.id}/${tyres} static batching draw budget`);const bounds=new THREE.Box3().setFromObject(kart.body);assert.ok(bounds.max.y>2);assert.ok(bounds.max.z>1.4);assert.ok(bounds.min.z<-1.4);
    assert.ok(kart.rollers.every((roller,index)=>roller.parent===kart.wheels[index]));disposeGroup(kart.root);
  }
});
