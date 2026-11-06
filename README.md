# Projek-grafkombruh

## Struktur folder

- `Mouthe/Character.js` : karakter pertama (Mouthe)
- `Gundog/Character.js` : karakter kedua (Gundog)
- `Knifo/Character.js` : karakter ketiga (Knifo)
- `MyObject.js`, `Shapes.js` : kelas dan pembuat bentuk yang dipakai bersama
- `environment.js` : maze dan lantai

## Skala karakter

Atur skala seragam Mouthe, Gundog, dan Knifo lewat `CHARACTER_SCALE` di `main.js`.
Angka `1` berarti ukuran asli; angka lebih besar memperbesar karakter dan angka
antara `0` dan `1` memperkecilnya. Posisi telapak disesuaikan agar karakter tetap
berpijak di lantai.

## Maze layout

Maze berisi 7 ruangan (R1 awal; R2, R3 dari pertigaan pertama; R4-R7 dari pertigaan
kedua dan ketiga). Atur ukurannya di `MAZE_LAYOUT` pada `environment.js` (satuan dunia):

- ruangan `{ width, depth }`  : lebar (sumbu X) dan panjang (sumbu Z)
- hallway `{ length, width }` : panjang searah jalan dan lebar jalan
- pertigaan `{ width, toRx, toRy }` : lebar jalan melintang dan jarak dari sumbu hallway
  ke dinding terdekat ruangan tujuan

Posisi semua bagian dihitung otomatis. Jika ukuran tidak muat atau bertabrakan,
halaman menampilkan pesan error yang menyebut bagian mana yang bermasalah.
Lantai memakai permukaan tidak rata dengan retakan; atur lewat `TERRAIN`
(`step`, `patchDensity`, `maxRelief`, `crackDensity`). Atur tinggi dan tebal dinding
lewat `WALL.height` dan `WALL.thickness`.

## Camera controls

Click the canvas to capture the mouse and look around. Use `W`, `A`, `S`, and
`D` to move, `Space` to rise, and `Shift` to descend. Press `Esc` to release
the mouse.
Scroll the mouse wheel while the mouse is captured to adjust the speed of all
movement controls. Press `-` to decrease mouse-look sensitivity or `=` to
increase it.