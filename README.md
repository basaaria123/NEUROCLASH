# NEUROCLASH AI

A futuristic 3D browser combat prototype built with React, TypeScript, Vite, Three.js, and React Three Fiber. The player is a cyan operative; Neuro is a magenta adaptive opponent.

## Run locally

1. Install Node.js (current LTS recommended).
2. Extract this project and open a terminal in the folder containing `package.json`.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev` and open the local URL printed in the terminal (usually `http://localhost:5173`).

## Controls

- **W A S D / arrow keys:** Move
- **E / Space / left mouse button:** Fire the selected weapon
- **1 / 2 / 3:** Select energy blade, pulse shot, or burst shot
- **Shift while moving:** Sprint/dash (uses a cooldown)
- **Q:** Phase shield
- **Esc / P:** Pause

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Push to GitHub

### GitHub Desktop
1. Extract the ZIP.
2. In GitHub Desktop, choose **File → Add Local Repository** or **Create a New Repository**.
3. Select the extracted folder, commit the files, then publish the repository to GitHub.

### Terminal
Create an empty repository on GitHub, then run these commands from this folder:

```bash
git init
git add .
git commit -m "Polish NeuroClash AI game prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your own. If this folder is already a Git repository, check `git status` and `git remote -v` before running `git init`.

## Implementation notes

- Character fighters are procedural Three.js models; no external 3D model downloads are required.
- Combat sounds are synthesized locally through the Web Audio API; no audio files or network calls are required.
- The **Made in Bolt** badge visible in the Bolt editor/preview is editor UI, not part of the React app. It cannot be removed by editing the app source, but it does not ship as part of the production website.
- This project uses **React Three Fiber / Three.js**, not Phaser.
- This updated source package was prepared, but a full build/typecheck could not be confirmed in this environment because dependency installation did not complete. Run the quality checks above after `npm install`.
