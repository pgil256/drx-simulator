# DRX Simulator

Browser-based 3D simulator for the DRX knee decompression device.

The DRX is a chair-mounted, computer-controlled device that uses three actuators (axial, horizontal, lateral) and pneumatic pressure to deliver guided knee decompression therapy. This simulator mirrors the device's serial command protocol and runs the same four treatment protocols (axial, left lateral, right lateral, oscillating) entirely in the browser, with a real-time 3D model that responds to actuator commands.

**Live demo:** https://web-eight-olive-20.vercel.app

## Stack

- **Vite + React 19 + TypeScript** — UI shell
- **three.js + @react-three/fiber + @react-three/drei** — 3D scene, GLB rendering, OrbitControls
- **Zustand** — application state (device, session, UI)
- **Tailwind v4 + shadcn/ui** — styling and primitives
- **Vitest** — unit tests for the simulation engine
- **Vercel** — hosting and CI/CD

## Layout

```
web/
├── src/
│   ├── scene/      # R3F scene, GLB loading, camera presets
│   ├── sim/        # Simulated device, protocol runner, command parser
│   ├── store/      # Zustand store
│   ├── ui/         # Top bar, bottom nav, page router, page components
│   └── components/ # shadcn/ui primitives
├── public/
│   └── models/     # drx.glb (the device 3D model)
└── scripts/        # STEP→GLB conversion pipeline (one-off)
```

## Running locally

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

## Tests

```bash
npm test             # runs vitest once
npm run test:watch   # watch mode
```

The sim engine (command parser, easing step function, simulated device, protocol runner) is fully unit-tested.

## Build

```bash
npm run build        # tsc -b && vite build → web/dist
npm run preview      # serve the built bundle locally
```

## Deploy

Pushes to `main` auto-deploy to Vercel. Manual deploys:

```bash
cd ..               # repo root, not web/
vercel --prod --yes
```

The Vercel project's root directory is set to `web/`, so deploys must run from the **repo root** (the CLI appends rootDirectory to its cwd).

## Device command reference

The simulator accepts the same single-letter commands as the real DRX firmware:

| Command       | Effect                                        |
| ------------- | --------------------------------------------- |
| `P<lbs>`      | Set pressure target (0–80 lbs)                |
| `A12 <in>`    | Move axial actuator (0–4 in)                  |
| `B<deg>`      | Move horizontal actuator (-25 to 5°)          |
| `K <deg>`     | Move lateral actuator (-20 to 20°)            |
| `J` / `JS`    | Start / stop continuous pulse                 |
| `X`           | Emergency stop (latches until reset)          |
| `T`           | Keepalive / connection test                   |

## Treatment protocols

| Id  | Name           | Behavior                                                        |
| --- | -------------- | --------------------------------------------------------------- |
| 1   | Axial          | Pressure ramp + hold, with optional pulsing                     |
| 2   | Left Lateral   | Ramp pressure, swing cuff to negative angle, hold/pulse         |
| 3   | Right Lateral  | Ramp pressure, swing cuff to positive angle, hold/pulse         |
| 4   | Oscillating    | Ramp pressure, then alternate left↔right while holding/pulsing  |

The "Demo Speed" slider on the Protocols page lets you accelerate playback up to 10× wall time so a full sequence runs in seconds rather than minutes.
