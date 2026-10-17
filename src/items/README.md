# Items

`Inventory.ts` owns an active slot and reserve, bounded capacity, draw delay and automatic promotion. `ItemWorld.ts` owns stable pickup IDs, respawn/racer cooldowns, coins, weighted draws and a bounded pool of banana traps / bouncing shells. Mushrooms invoke the shared kart boost. Human and AI item use share all activation, damage, immunity and ownership rules. Typed definitions and draw weights live in `src/data/items.ts`; durations/limits live in `src/data/config.ts`.
