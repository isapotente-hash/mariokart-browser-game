# Opponents

`AiDriver.ts` follows course samples with speed-dependent look-ahead, curvature/braking-distance-aware speed choices, surface and hazard response, lane overtaking with cooldowns, and seeded traits. Seven instances compete through the same `Race`, `KartController`, `LapProgress`, `Inventory` and `ItemWorld` interfaces as the player. There are no physics or progress exemptions, catch-up teleports or rubber-banding. Stuck recovery requests the shared checkpoint rescue and pays the same two-second delay.
