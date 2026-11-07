// Ring projectiles: bounce off blocks losing speed. A portal ring opens a gate where it lands, and
// the last two gates of the same shooter are linked: whoever enters one leaves by the other.
// If this script fails to run, rings simply disappear on impact.
import { world, system, Direction, EntityDamageCause } from '@minecraft/server';
import './smash.js';
import './anger.js';
import { trap } from './trap.js';
import { enemyInFront } from './aim.js';

const FAMILY = 'sw_ring';
const RESTITUTION = 0.55;   // speed kept along the surface normal
const FRICTION = 0.72;      // speed kept along the surface
const MIN_SPEED = 0.12;     // blocks per tick, below this the ring dies
const MAX_BOUNCES = 6;
const POINT_BLANK = 3.5;    // blocks: closer than this, a new ring would spawn past the enemy
const SHOT_DAMAGE = [5, 7];
const GATE_REACH = 1.4;     // blocks from the centre of a gate
const GATE_COOLDOWN = 60;   // ticks before the same entity can travel again
const FADE_IN = 0.2, FADE_HOLD = 0.15, FADE_OUT = 0.35;   // seconds of the screen fade on players
const DIMENSIONS = ['overworld', 'nether', 'the_end'];
const NORMALS = {
  [Direction.Up]: { x: 0, y: 1, z: 0 }, [Direction.Down]: { x: 0, y: -1, z: 0 },
  [Direction.North]: { x: 0, y: 0, z: -1 }, [Direction.South]: { x: 0, y: 0, z: 1 },
  [Direction.West]: { x: -1, y: 0, z: 0 }, [Direction.East]: { x: 1, y: 0, z: 0 },
};
const END_PARTICLE = { 'sw:ring_shot': 'sw:spark_burst', 'sw:ring_fire': 'sw:charge_fire', 'sw:ring_portal': 'sw:charge_portal' };

// A shot spawns some way ahead of Sparky, so an enemy at arm's length is already behind the ring.
function pointBlank(ring) {
  if (!ring.typeId.startsWith('sw:ring_')) return false;
  const owner = ring.getComponent('minecraft:projectile')?.owner;
  if (!owner?.isValid) return false;
  const v = enemyInFront(owner, POINT_BLANK, 100);
  if (!v) return false;
  const damage = SHOT_DAMAGE[0] + Math.floor(Math.random() * (SHOT_DAMAGE[1] - SHOT_DAMAGE[0] + 1));
  v.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: owner });
  if (ring.typeId === 'sw:ring_fire') v.setOnFire(5, true);
  if (ring.typeId === 'sw:ring_portal') openGate(v.dimension, { x: v.location.x, y: v.location.y + 1.1, z: v.location.z }, owner);
  v.dimension.spawnParticle(END_PARTICLE[ring.typeId], v.location);
  ring.remove();
  return true;
}

// The hit event comes too late to read the speed from the projectile, so remember it every tick.
let seen = new Map(), before = new Map();
const bounces = new Map();

system.runInterval(() => {
  before = seen; seen = new Map();
  for (const name of DIMENSIONS) {
    for (const e of world.getDimension(name).getEntities({ families: [FAMILY] })) {
      if (!before.has(e.id) && !bounces.has(e.id) && pointBlank(e)) continue;
      seen.set(e.id, { type: e.typeId, location: e.location, velocity: e.getVelocity(), bounces: bounces.get(e.id) ?? 0, fading: e.getProperty('sw:fading') === true });
    }
  }
  for (const id of bounces.keys()) if (!seen.has(id) && !before.has(id)) bounces.delete(id);
});

// Gates live 12 s (sw:close in the entity). The pair is remembered here per shooter.
const gates = new Map();
const cooldown = new Map();

function openGate(dimension, at, source) {
  let key = 'none';
  try { if (source?.isValid) key = source.id; } catch { /* no shooter left */ }
  const gate = dimension.spawnEntity('sw:portal_gate', at);
  const list = gates.get(key) ?? [];
  list.push(gate.id);
  while (list.length > 2) world.getEntity(list.shift())?.remove();
  gates.set(key, list);
  dimension.playSound('mob.endermen.portal', at);
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, until] of cooldown) if (until <= now) cooldown.delete(id);
  for (const [key, list] of gates) {
    const open = list.map((id) => world.getEntity(id)).filter((e) => e?.isValid);
    if (!open.length) { gates.delete(key); continue; }
    gates.set(key, open.map((e) => e.id));
    if (open.length < 2) continue;
    for (const [from, to] of [[open[0], open[1]], [open[1], open[0]]]) {
      const near = from.dimension.getEntities({ location: from.location, maxDistance: GATE_REACH, excludeFamilies: ['sparky', 'inanimate'] });
      for (const e of near) {
        if (cooldown.has(e.id) || !e.getComponent('minecraft:health')) continue;
        cooldown.set(e.id, now + GATE_COOLDOWN);
        const out = { x: to.location.x, y: to.location.y - 1, z: to.location.z }, into = from.location, exit = to.location, far = to.dimension;
        const travel = () => {
          try {
            if (!e.isValid || !e.tryTeleport(out, { dimension: far, checkForBlocks: true, keepVelocity: false })) return;
            from.dimension.spawnParticle('sw:charge_portal', into);
            far.spawnParticle('sw:charge_portal', exit);
            far.playSound('mob.endermen.portal', exit);
          } catch (error) {
            console.warn(`sw rings gate: ${error}`);
          }
        };
        if (e.typeId === 'minecraft:player') {   // the screen closes first, so the jump happens in the dark
          e.runCommand(`camera @s fade time ${FADE_IN} ${FADE_HOLD} ${FADE_OUT} color 40 10 70`);
          system.runTimeout(travel, Math.round(FADE_IN * 20));
        } else {
          travel();
        }
      }
    }
  }
}, 2);

const length = (v) => Math.hypot(v.x, v.y, v.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function record(ev) {
  let id;
  try { id = ev.projectile.id; } catch { id = undefined; }
  if (id !== undefined) {
    const a = seen.get(id), b = before.get(id);
    if (!a || !b) return a ?? b;
    return length(a.velocity) >= length(b.velocity) ? a : b;   // the newest sample may already be stopped
  }
  let best, gap = 3;
  for (const r of [...before.values(), ...seen.values()]) {
    const d = distance(r.location, ev.location);
    if (d <= gap) { best = r; gap = d; }
  }
  return best;
}

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  try {
    const r = record(ev);
    if (!r || r.fading || r.type === 'sw:trap_sphere') return;
    const n = NORMALS[ev.getBlockHit().face];
    if (!n) return;
    if (r.type === 'sw:ring_portal') {   // stands on the floor, away from walls and ceilings
      const at = ev.location, up = n.y > 0 ? 1.1 : n.y < 0 ? 1.3 : 0.7;
      openGate(ev.dimension, { x: at.x + n.x * up, y: at.y + n.y * up, z: at.z + n.z * up }, ev.source);
      return;
    }
    const v = r.velocity, into = v.x * n.x + v.y * n.y + v.z * n.z;
    if (into >= 0) return;
    const out = {
      x: (v.x - into * n.x) * FRICTION - into * RESTITUTION * n.x,
      y: (v.y - into * n.y) * FRICTION - into * RESTITUTION * n.y,
      z: (v.z - into * n.z) * FRICTION - into * RESTITUTION * n.z,
    };
    const last = r.bounces >= MAX_BOUNCES || length(out) < MIN_SPEED;
    const at = ev.location;
    const ring = ev.dimension.spawnEntity(r.type, { x: at.x + n.x * 0.45, y: at.y + n.y * 0.45, z: at.z + n.z * 0.45 });
    const projectile = ring.getComponent('minecraft:projectile');
    if (ev.source?.isValid) projectile.owner = ev.source;
    if (last) {   // stays where it stopped and shrinks away
      projectile.gravity = 0;
      projectile.shoot({ x: 0, y: 0.001, z: 0 }, { uncertainty: 0 });
      ring.triggerEvent('sw:fade');
    } else {
      projectile.shoot(out, { uncertainty: 0 });
    }
    bounces.set(ring.id, r.bounces + 1);
  } catch (error) {
    console.warn(`sw rings bounce: ${error}`);
  }
});

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  try {
    const r = record(ev);
    const hit = ev.getEntityHit().entity;
    if (r?.type === 'sw:trap_sphere') { trap(hit, ev.dimension, ev.source); return; }
    if (r?.type !== 'sw:ring_portal') return;
    const at = hit?.isValid ? hit.location : ev.location;
    openGate(ev.dimension, { x: at.x, y: at.y + 1.1, z: at.z }, ev.source);
  } catch (error) {
    console.warn(`sw rings portal: ${error}`);
  }
});
