# DROP ARENA

A complete, mobile-friendly falling-block puzzle game for GitHub Pages. Play Puyo-style chains and Tetris-style line clearing against the CPU, on one shared device, or online with a friend.

## Play modes

- **CPU battle:** choose either puzzle independently, with three CPU difficulties and one-, two-, or three-win matches.
- **Local battle:** simultaneous two-player play with separate keyboard bindings and touch pads.
- **Online battle:** invite code, invitation link, QR code, ready check, live opponent board, latency display, reconnect, and rematch.
- **Swap:** switch between separately preserved Puyo and Tetris boards every 25 seconds. Active chains finish before switching.
- **Practice:** unlimited play, automatic local saves, pause, resume, and session records.
- **Time attack:** clear 40 Tetris lines as quickly as possible, or maximize the Puyo score over 120 seconds.

## Rules

Puyo uses a six-column, twelve-visible-row field with two hidden rows. Groups of four or more orthogonally connected colors clear together; gravity can trigger additional chains. Adjacent garbage disappears with colored groups. Chain, color, group, and all-clear bonuses contribute to scoring and attacks. The marked spawn cell determines top-out.

Tetris uses ten columns and twenty visible rows, plus two hidden rows. It includes seven-bag randomization, five-piece preview, hold, a landing guide, SRS kicks, a 500 ms lock delay with a 15-reset cap, T-spin recognition, combos, back-to-back bonuses, and perfect clears.

Attacks first cancel the sender's pending garbage. Simultaneous attacks cancel each other. One Tetris garbage row equals six Puyo garbage units; fractional row units remain pending. Garbage arrives after piece resolution, at most eight Tetris rows or thirty Puyos at once. Both players receive the same piece sequence for the same puzzle type. The CPU searches reachable placements and evaluates the resulting board.

This is an independent fan-made implementation. It is not affiliated with an official game or service and does not reproduce all official scoring, timing, or competitive balance rules. All visual artwork and synthesized sound effects are original.

## Controls

| Action           | Solo / online | Local player 1 | Local player 2 |
| ---------------- | ------------- | -------------- | -------------- |
| Move             | Left / Right  | A / D          | Left / Right   |
| Soft drop        | Down          | S              | Down           |
| Clockwise        | Up / X        | W / E          | Up / Period    |
| Counterclockwise | Z             | Q              | Comma          |
| Hard drop        | Space         | F              | Enter          |
| Hold             | C / Shift     | R              | Right Shift    |
| Pause            | Escape / P    | Escape / P     | Escape / P     |

Touch controls support pointer capture, simultaneous fingers, directional repeat, and pointer cancellation. Directional delay and repeat speed are adjustable. Settings include sound, volume, landing guides, color identification marks, and vibration on supported devices. The interface honors reduced-motion preferences.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use the production build served by Vite preview. They cover complete game flows, deterministic saved-board scenarios, keyboard and mobile touch interactions, accessibility, corrupt storage recovery, and an actual PeerJS/WebRTC connection between isolated browser contexts. The online test requires access to the signaling service and working WebRTC networking.

To use an existing Chrome installation:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
PLAYWRIGHT_CHANNEL=chrome node tests/capture.mjs
```

For WebKit compatibility checks:

```sh
npx playwright install webkit
PLAYWRIGHT_BROWSER=webkit npm run test:e2e -- tests/game.spec.ts
```

To verify a deployed site, set `PLAYWRIGHT_BASE_URL` to its full URL, including the trailing slash. Generated screenshots, traces, builds, and dependency directories are ignored by Git.

## GitHub Pages

Enable **Settings → Pages → Source → GitHub Actions**. Push to `main` or run the deployment workflow manually. The workflow checks formatting, unit tests, the production build, and browser tests before publishing `dist/`. Relative asset paths allow deployment under a repository subpath without a hard-coded account or repository name.

The application requires no application server. Online discovery uses PeerJS signaling, and game data travels over a WebRTC data channel. The host runs the authoritative game simulation; the guest receives snapshots and predicts its own outstanding inputs. Player tokens prevent a different guest from taking an occupied slot. Input validation and rate limiting protect the host against malformed commands; this is a casual friend-to-friend game, not a cheat-proof ranked service.

## Connections and persistence

- Keep both tabs open during online play. Backgrounding a tab or losing the connection pauses play.
- On reconnect, the host provides the authoritative board. The guest indicates readiness, and the host resumes.
- Reloading the same tab retains the online room identity in session storage. Host snapshots are also retained in that tab. Returning from a closed tab is not guaranteed.
- Default signaling and STUN service availability depend on external providers. Symmetric NATs and restricted networks may require a TURN relay. The connection settings accept a TURN URL and credentials, or a custom PeerServer host, port, path, and TLS setting.
- TURN credentials stay in memory for the current page. They are never included in invitations or saved to browser storage.
- Offline saves, preferences, and the last thirty results are stored only in the current browser. Browser storage restrictions or clearing site data remove this persistence. Battle records show the final round's score.
- The game provides responsive browser layouts; browser viewport testing does not substitute for physical iOS or Android device testing.

## Structure

| Path                 | Responsibility                                         |
| -------------------- | ------------------------------------------------------ |
| `src/game/engine.ts` | Deterministic board, clear, attack, and match rules    |
| `src/game/pieces.ts` | Piece geometry, randomizer, projection, and SRS kicks  |
| `src/game/ai.ts`     | Reachable CPU placement search and heuristics          |
| `src/lib/network.ts` | Room protocol, synchronization, and reconnect          |
| `src/lib/useGame.ts` | Fixed-step simulation and browser lifecycle            |
| `src/lib/input.ts`   | Keyboard and touch repeat handling                     |
| `src/lib/storage.ts` | Validated settings, saves, and history                 |
| `src/components/`    | SVG boards, controls, dialogs, and application screens |
| `tests/`             | Rule, integration, accessibility, and visual checks    |

Source is available under the repository's MIT license. The names of established games remain the property of their respective owners.
