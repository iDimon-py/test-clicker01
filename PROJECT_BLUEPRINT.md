# Cosmic Clicker: Technical Blueprint & Architecture

## 1. Executive Summary
This is a high-performance, single-page React application designed as a Telegram Mini App style clicker game. It features high-fidelity UI (glassmorphism), a particle system rendered via Canvas API for performance, and a robust offline-first synchronization strategy using Supabase.

## 2. Tech Stack & Dependencies
*   **Framework:** React 19 (Hooks intensive: `useState`, `useEffect`, `useRef`).
*   **Styling:** Tailwind CSS (via CDN for portability).
*   **Icons:** Lucide React.
*   **Backend:** Supabase (PostgreSQL) + LocalStorage fallback.
*   **Fonts:** 'Outfit' (Google Fonts).

## 3. Core Architecture & State Management

### A. The "Ref-State" Pattern
To handle high-frequency events (clicking) and safety-critical events (closing the tab), the app uses a dual-storage approach in `App.tsx`:
1.  **State (`useState`)**: Drives the UI rendering.
2.  **Refs (`useRef`)**: Holds the *latest* values of score, energy, etc.
    *   *Why?* Event listeners like `beforeunload` or `setInterval` closures capture stale state. Refs allow accessing the immediate value inside these closures without re-binding listeners, preventing memory leaks and logic errors.

### B. Offline-First Database Layer (`db.ts`)
The database layer (`db.ts`) is designed to prioritize user experience and data safety:
1.  **Read Strategy:** Checks LocalStorage first (instant load), then fetches from Supabase.
2.  **Conflict Resolution:** If LocalStorage score > Supabase score (e.g., user played offline), the local data overwrites the cloud data.
3.  **Write Strategy:**
    *   Immediate write to LocalStorage.
    *   Async "fire-and-forget" write to Supabase.
    *   If Supabase is unreachable, the app continues in "Offline Mode" seamlessly.

## 4. Performance Engineering

### A. Canvas Particle System
Instead of rendering DOM nodes (divs) for every coin particle, we use a single `<canvas>` element overlay.
*   **Implementation:** `requestAnimationFrame` loop in `App.tsx`.
*   **Logic:** Manages array of particle objects (x, y, velocity, life).
*   **Benefit:** Capable of rendering hundreds of particles at 60fps without layout thrashing.

### B. CSS Hardware Acceleration
*   **3D Tilt:** The main button uses `perspective`, `rotateX`, and `rotateY` calculated from pointer coordinates.
*   **Animations:** All animations (float-up, pulse) use `transform` and `opacity` to ensure GPU compositing.

## 5. Game Economy & Mechanics

### A. Energy System
*   **Cap:** Defined by `MAX_ENERGY` (increases with skins).
*   **Regen:** Interval based on `ENERGY_REGEN_RATE_MS`.
*   **Consumption:** `ENERGY_COST_PER_CLICK`.

### B. Skins System (`constants.ts`)
Skins are not just cosmetic; they act as the upgrade tree:
*   `clickMultiplier`: Increases points per tap.
*   `maxEnergy`: Increases tank capacity.
*   `regenRateSec`: Improves recovery speed.
*   *Visuals:* Each skin has unique SVG paths and Tailwind color gradients/glows.

### C. Safety Saving
To prevent data loss:
1.  **Interval Sync:** Autosave every `SYNC_INTERVAL_MS` (default 10s).
2.  **Force Save:** Triggers on `window.beforeunload` and `document.visibilitychange` (tab switch/close).

## 6. File Structure & Responsibilities

*   **`App.tsx`**: The "Game Engine". Handles the loop, input, UI composition, and acts as the controller.
*   **`db.ts`**: The "Data Layer". Adapter pattern transforming DB `snake_case` to App `camelCase`. Handles Supabase and LocalStorage logic.
*   **`constants.ts`**: The "Config". Single source of truth for game balance, skins, and API intervals.
*   **`components/ClickButton.tsx`**: Interactive core. Handles 3D tilt logic and haptic/visual feedback.
*   **`components/EnergyBar.tsx`**: Visual representation of the energy tank.

## 7. Visual Style Guide (Aesthetics)
*   **Theme:** Cosmic/Dark Mode.
*   **Backgrounds:** Deep gradients (Slate-900 to Black) + Stardust texture overlays.
*   **Glassmorphism:** `backdrop-blur`, semi-transparent borders, and inner shadows used on panels.
*   **Animations:** Smooth transitions, floating text for damage numbers, particle explosions on click.

## 8. Instructions for AI Replication
If asking another AI to modify this project:
1.  **Respect the Refs:** Always update the Ref when updating State if that variable is needed in a timer or event listener.
2.  **Preserve Constants:** Do not hardcode magic numbers in components; use `constants.ts`.
3.  **Maintain Types:** Ensure `UserData` interface matches the Supabase schema mapping in `db.ts`.
4.  **Aesthetics First:** Keep the Tailwind classes for glows, gradients, and blurs. This allows the "premium" feel.
