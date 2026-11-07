// Hitting Sparky makes him hunt players for a while: sw:calm_angry adds them to his target list.
import { world, system } from '@minecraft/server';

const ANGER_TICKS = 1200;   // 60 s after the last hit from a player
const angry = new Map();

world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    if (ev.damageSource.damagingEntity?.typeId !== 'minecraft:player') return;
    const e = ev.hurtEntity;
    if (!angry.has(e.id)) e.triggerEvent('sw:get_angry');
    angry.set(e.id, system.currentTick + ANGER_TICKS);
  } catch (error) {
    console.warn(`sw anger: ${error}`);
  }
}, { entityTypes: ['sw:sparky'] });

system.runInterval(() => {
  for (const [id, until] of angry) {
    if (system.currentTick < until) continue;
    angry.delete(id);
    const e = world.getEntity(id);
    if (e?.isValid) e.triggerEvent('sw:calm_down');
  }
}, 20);
