# Projek-grafkombruh

## Maze layout

Edit `MAZE_POINTS` in `environment.js` to define the maze wall outline. Enter
coordinates as `[x, z]` pairs in world units; every point connects to the next,
and the final point connects back to the first. The floor is a simple rectangle
under the outline. Adjust `WALL.height` and `WALL.thickness` independently to
change the wall dimensions.