// Sphere form ground smash: crouch, leap at the nearest enemy, hang, drive down, shockwave on landing.
// Timing lives here because only a script can throw Sparky. sw:smashing resets him if this stops running.
import { world, system, EntityDamageCause } from '@minecraft/server';
import { enemyInFront, NOT_ENEMY } from './aim.js';

const CROUCH = 7;           // ticks before leaving the ground, matches smash_leap
const LEAP_UP = 1.1;        // blocks per tick, peak about 6 blocks
const AIR_TICKS = 21;       // ticks from take-off to landing
const STEER_MAX = 1.1;      // blocks per tick sideways while steering onto the enemy
const DRIVE_DOWN = 0.9;     // extra speed downward once he starts falling
const RECOVER = 14;         // ticks of smash_slam before going back to normal
const RADIUS = 6;           // blocks of the shockwave
const HIT_CENTRE = 16, HIT_EDGE = 6;

const running = new Map();
// Every tick in the air, set the sideways speed that arrives over the enemy when he lands, wherever it moved to.
function steer(e, s, ticksLeft) {
  const from = e.location, to = s.last, v = e.getVelocity();
  let x = (to.x - from.x) / ticksLeft, z = (to.z - from.z) / ticksLeft;
  const speed = Math.hypot(x, z);
  if (speed > STEER_MAX) { x *= STEER_MAX / speed; z *= STEER_MAX / speed; }
  e.applyImpulse({ x: x - v.x, y: 0, z: z - v.z });
}

function shockwave(e) {
  const at = e.location, dimension = e.dimension, rage = e.getProperty('sw:phase') === 'rage';
  dimension.spawnParticle('sw:smash_wave', { x: at.x, y: at.y + 0.15, z: at.z });
  dimension.spawnParticle('sw:spark_burst', { x: at.x, y: at.y + 0.3, z: at.z });
  dimension.playSound('mace.heavy_smash_ground', at, { volume: 2, pitch: 0.7 });
  e.runCommand('camerashake add @a[r=14] 0.4 0.5 positional');
  for (const v of dimension.getEntities({ location: at, maxDistance: RADIUS, excludeFamilies: NOT_ENEMY.slice(0, 2) })) {
    if (!v.getComponent('minecraft:health')) continue;
    const dx = v.location.x - at.x, dz = v.location.z - at.z, flat = Math.hypot(dx, dz) || 0.01;
    const near = Math.max(0, 1 - Math.hypot(flat, v.location.y - at.y) / RADIUS);
    const damage = Math.round((HIT_EDGE + (HIT_CENTRE - HIT_EDGE) * near) * (rage ? 1.5 : 1));
    v.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
    const force = 0.5 + near * 1.3;
    v.applyKnockback({ x: (dx / flat) * force, z: (dz / flat) * force }, 0.45 + near * 0.35);
  }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
  try {
    const e = ev.entity;
    if (running.has(e.id) || e.getProperty('sw:form') !== 'spheres' || !e.isOnGround || e.isInWater) return;
    const aim = enemyInFront(e, 16, 70);
    if (!aim) return;
    e.lookAt(aim.location);
    e.triggerEvent('sw:smash_begin');
    running.set(e.id, { stage: 'crouch', tick: 0, aim, last: aim.location });
  } catch (error) {
    console.warn(`sw smash start: ${error}`);
  }
}, { entityTypes: ['sw:sparky'], eventTypes: ['sw:smash_try'] });

system.runInterval(() => {
  for (const [id, s] of running) {
    try {
      const e = world.getEntity(id);
      if (!e?.isValid) { running.delete(id); continue; }
      s.tick += 1;
      if (s.aim?.isValid) s.last = s.aim.location;
      const landed = e.isOnGround || e.isInWater;
      const land = () => { e.triggerEvent('sw:smash_land'); shockwave(e); s.stage = 'recover'; s.tick = 0; };
      if (s.stage === 'crouch' && s.tick >= CROUCH) {
        e.applyImpulse({ x: 0, y: LEAP_UP, z: 0 });
        steer(e, s, AIR_TICKS); s.stage = 'air'; s.tick = 0;
      } else if (s.stage === 'air') {
        if (s.tick > 4 && (landed || s.tick > 50)) land();
        else {
          steer(e, s, Math.max(1, AIR_TICKS - s.tick));
          if (s.tick > 4 && e.getVelocity().y < -0.03) {
            e.applyImpulse({ x: 0, y: -DRIVE_DOWN, z: 0 });
            e.triggerEvent('sw:smash_fall'); s.stage = 'fall'; s.tick = 0;
          }
        }
      } else if (s.stage === 'fall') {
        if (landed || s.tick > 30) land();
        else steer(e, s, Math.max(1, (e.location.y - s.last.y) / 1.2));
      } else if (s.stage === 'recover' && s.tick >= RECOVER) {
        e.triggerEvent('sw:smash_end'); running.delete(id);
      }
    } catch (error) {
      running.delete(id);
      console.warn(`sw smash: ${error}`);
    }
  }
});
