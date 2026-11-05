# Projek-grafkombruh

## Maze layout

Edit `MAZE_POINTS` in `environment.js` to define the maze wall outline. Enter
coordinates as `[x, z]` pairs in world units; every point connects to the next,
and the final point connects back to the first. The floor is a worn rectangular
slab with subtle, seeded uneven patches and cracks. Adjust `TERRAIN` in
`environment.js` to change the terrain grid, relief, or crack count. Adjust
`WALL.height` and `WALL.thickness` independently to change the wall dimensions.

## Camera controls

Click the canvas to capture the mouse and look around. Use `W`, `A`, `S`, and
`D` to move, `Space` to rise, and `Shift` to descend. Press `Esc` to release
the mouse.
Scroll the mouse wheel while the mouse is captured to adjust the speed of all
movement controls.