
# Sparky-World TO-DO

## Sparky (v0.3.0)
- [x] Walk animation (molang, legs + arms + knees + bounce)
- [x] Two forms: rings (ranged, spark bolt between the rings) <-> spheres (melee punch)
- [x] Transform animations rings <-> spheres (`to_spheres` / `to_rings`)
- [x] Sphere form ranged: throw sphere / trap sphere that closes and crushes (`sw:crush_cage`)
- [x] Rage mode at 25% HP: roar + knockback, violet skin, faster, 3-bolt bursts
- [x] Sounds (vanilla refs), particles, pt_PT / pt_BR / en_US texts
- [ ] Rings "open" visually: split each ring into two half-ring cubes so they can separate while charging
- [ ] Fire / portal variants of the ring attack (second projectile + particle set)
- [ ] Spheres that return to Sparky after being thrown (needs Script API)
- [ ] Custom sounds (own .ogg files) instead of vanilla references
- [ ] Death animation + custom hurt animation
- [ ] Re-import `SW/Rp/models/entity/Sparky.geo.json` + animations in Blockbench and save a new `Extra/Sparky.bbmodel` (the geo is now the source of truth: new bones `sphere_l`/`sphere_r`, locators, taller UV)

## Other characters
- [ ] (next character here)
