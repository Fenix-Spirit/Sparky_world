// Trap sphere: on hitting a creature it sticks over the head, blinds it and crushes it.
// The sphere is sw:crush_cage: it does no damage by itself and vanishes by its own timer (2.45 s).
import { world, system, EntityDamageCause } from '@minecraft/server';

const BLIND_TICKS = 60;
const SQUEEZE_TICKS = [12, 24, 36];   // at least 10 apart, or the game ignores the hit
const SQUEEZE_DAMAGE = 2;
const CRUSH_TICK = 47;                // just before the sphere bursts, matches animation.sw_crush_cage.life
const CRUSH_DAMAGE = 10;

const traps = new Map();

export function trap(victim, dimension, source) {
  if (!victim?.isValid || victim.typeId === 'sw:sparky') return;
  for (const t of traps.values()) if (t.victim.id === victim.id) return;
  const sphere = dimension.spawnEntity('sw:crush_cage', victim.getHeadLocation());
  traps.set(sphere.id, { victim, source, tick: 0 });
  victim.addEffect('blindness', BLIND_TICKS, { amplifier: 0, showParticles: false });
}

function hurt(t, amount) {
  const options = { cause: EntityDamageCause.entityAttack };
  if (t.source?.isValid) options.damagingEntity = t.source;
  t.victim.applyDamage(amount, options);
}

system.runInterval(() => {
  for (const [id, t] of traps) {
    try {
      const sphere = world.getEntity(id);
      if (!sphere?.isValid) { traps.delete(id); continue; }
      const health = t.victim.isValid ? t.victim.getComponent('minecraft:health') : undefined;
      if (!health || health.currentValue <= 0) { sphere.remove(); traps.delete(id); continue; }
      sphere.teleport(t.victim.getHeadLocation(), { dimension: t.victim.dimension });
      t.tick += 1;
      if (SQUEEZE_TICKS.includes(t.tick)) hurt(t, SQUEEZE_DAMAGE);
      if (t.tick === CRUSH_TICK) hurt(t, CRUSH_DAMAGE);
    } catch (error) {
      traps.delete(id);
      console.warn(`sw trap: ${error}`);
    }
  }
});
