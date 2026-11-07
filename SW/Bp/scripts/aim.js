// Who Sparky is fighting. The stable API does not expose an entity's target, but he always faces it,
// so the enemy closest to his line of sight is the best guess.
export const NOT_ENEMY = ['sparky', 'inanimate', 'creeper', 'animal', 'villager'];

export function enemyInFront(e, range, cone) {
  const from = e.location, look = e.getViewDirection(), lookFlat = Math.hypot(look.x, look.z) || 1;
  let best, bestScore = Infinity;
  for (const v of e.dimension.getEntities({ location: from, maxDistance: range, excludeFamilies: NOT_ENEMY })) {
    if (v.id === e.id || !v.getComponent('minecraft:health')) continue;
    const dx = v.location.x - from.x, dz = v.location.z - from.z, flat = Math.hypot(dx, dz);
    const cos = flat < 0.5 ? 1 : (dx * look.x + dz * look.z) / (flat * lookFlat);
    const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (angle > cone) continue;
    const score = angle + flat;
    if (score < bestScore) { best = v; bestScore = score; }
  }
  return best;
}
