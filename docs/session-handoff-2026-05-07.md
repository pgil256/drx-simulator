# DRX Simulator Session Handoff - 2026-05-07

## Current State

The simulator is in a visually acceptable state after rebuilding and tuning the DRX chair model from the Inventor-derived GLB. The chair, base extension, traction tray, and actuator motions now line up much more closely with the reference renders/videos than the original runtime transform tweaks.

The preview server was left running at:

```text
http://localhost:5173
```

If it is not running in the next session:

```bash
cd /home/gilhooleyp/projects/drx-simulator/web
source ~/.nvm/nvm.sh
nvm use 22.14.0
npm run dev -- --host 0.0.0.0 --port 5173
```

## Important Product Decisions

- The monitor, monitor stand, synthetic monitor arm, and drag-to-adjust monitor interaction were removed. Do not reintroduce them unless explicitly requested.
- The CAD side arm that hosted the monitor was hidden from the rendered model: `Handle 3:1` / `Handle_31` / `Handle31`.
- The video page was removed from the app shell.
- Pressure controls were removed from the setup page.
- Protocol pressure still maps to axial traction distance internally: greater pressure means greater axial distance.
- Lateral sign convention is now patient-frame:
  - `K -N` means patient left.
  - `K +N` means patient right.
  - The UI/protocol command signs were kept as-is; only the CAD hinge render mapping flips sign.

## Key Files Changed

- `web/public/models/drx.glb`
  - Regenerated/reorganized CAD-based model.
- `web/scripts/reorganize-glb.mjs`
  - Groups the model into `static_frame`, `horizontal_pivot`, `lateral_pivot`, and `axial_slider`.
- `web/src/scene/DeviceModel.tsx`
  - Applies actuator motion to CAD pivot groups.
  - Hides small fasteners and the removed side arm.
  - Adds axial jerk as slight physical movement, not glow.
  - Applies lateral sign conversion through `patientLateralDegToCadDeg`.
- `web/src/scene/motionConventions.ts`
  - Documents/implements patient-frame lateral to CAD hinge sign conversion.
- `web/src/scene/motionConventions.test.ts`
  - Regression test for the lateral sign convention.
- `web/src/ui/pages/ActuatorPanel.tsx`
  - Setup page actuator controls no longer include pressure.
- `web/src/ui/pages/ProtocolsPage.tsx`
  - Protocol setup no longer exposes pressure sliders; pressure-to-axial mapping remains in simulation.
- `web/src/App.tsx`, `web/src/ui/BottomNav.tsx`, `web/src/store/useAppStore.ts`
  - Video dialog/page state removed.
- `web/scripts/capture-browser-views.mjs`
  - Captures repeatable static screenshots.
- `web/scripts/capture-motion-views.mjs`
  - Captures repeatable actuator motion screenshots.
- `web/scripts/inspect-glb.mjs`, `web/scripts/inspect-motion.mjs`
  - Numeric GLB/motion inspection helpers.

## Verification Last Run

These passed in the latest session:

```bash
cd /home/gilhooleyp/projects/drx-simulator/web
source ~/.nvm/nvm.sh
nvm use 22.14.0
node node_modules/typescript/bin/tsc -b
npm test -- --run
npm run inspect:motion
npm run capture:motion
```

Latest test result:

```text
7 test files passed
47 tests passed
```

Motion inspection passed with the expected GLB pivot groups present.

## Visual Checkpoints

Latest screenshots were written under:

```text
web/test-artifacts/model-views/
web/test-artifacts/model-motion/
```

Important frames to inspect first:

- `web/test-artifacts/model-views/side.png`
  - Confirms monitor/stand/side arm are gone.
- `web/test-artifacts/model-views/overhead.png`
  - Confirms tray/base extension centerline still looks aligned.
- `web/test-artifacts/model-motion/lateral-neg20.png`
  - Confirms negative lateral swings to patient left.
- `web/test-artifacts/model-motion/lateral-pos20.png`
  - Confirms positive lateral swings to patient right.
- `web/test-artifacts/model-motion/pulse-axial-a.png` and `pulse-axial-b.png`
  - Confirms jerk/pulse is visible as slight axial motion.

## Known Caveats

- The worktree is intentionally dirty with many related model/app changes. Do not reset or checkout files blindly.
- Some of the implementation is still pragmatic runtime rendering around the CAD model. It is acceptable for now because the user preferred removing the over-engineered monitor path rather than adding more model-side complexity.
- `rg` from the Windows app path failed once with a permission issue inside WSL; use `grep -R` or install/use WSL-native `rg` if needed.
- Detached Vite background launch through WSL can trip a Node stdio assertion. Starting it in a normal terminal works.

## Suggested Next Session Start

1. Open the running preview at `http://localhost:5173`.
2. Check side, overhead, and 3/4 presets.
3. Exercise:
   - axial 0 -> 4 in,
   - horizontal -25 -> 5 deg,
   - lateral -20 -> +20 deg.
4. If no new visual issues appear, prepare a clean commit/PR from the current worktree.

## Do Not Revisit Unless Requested

- Do not add the monitor back.
- Do not add drag-and-drop monitor interaction.
- Do not add pressure controls back to Setup.
- Do not add the Video page back.
