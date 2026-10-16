# FreeFocusGames — Brain Training Games & Focus Tools

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fwww.freefocusgames.com)](https://www.freefocusgames.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

FreeFocusGames is an open-source collection of browser games and tools for practicing attention, memory, visual search, and reaction speed. Play online, explore the source code, or run the project locally. The site supports English and Chinese.

**[Play online](https://www.freefocusgames.com) · [Browse all games](https://www.freefocusgames.com/games) · [中文版](https://www.freefocusgames.com/zh)**

## 🧠 About This Project

This repository contains the source code for [FreeFocusGames](https://www.freefocusgames.com). It brings together interactive versions of tasks such as Dual N-Back, the Stroop task, and Schulte tables, alongside focus timers and casual games.

The source is available for studying how the games generate stimuli, handle input, calculate scores, and display results.

## 🎮 Included Games & Algorithms

A selection of the games and tools available on the site. Each name links directly to the playable page.

| Game or tool | How it works |
| --- | --- |
| [Dual N-Back](https://www.freefocusgames.com/games/dual-n-back) | Track visual positions and sounds, then identify matches with the stimuli presented N steps earlier. |
| [Schulte Table](https://www.freefocusgames.com/games/schulte-table) | Find and select the numbers in a shuffled grid in ascending order while tracking completion time and mistakes. |
| [Rotating Schulte Table](https://www.freefocusgames.com/games/rotating-schulte-table) | Find numbers 1–42 across three independently rotating rings. Each incorrect click adds two seconds to the final time. |
| [Stroop Effect Test](https://www.freefocusgames.com/games/stroop-effect-test) | Respond to a word's ink color while ignoring its meaning, then compare response times for matching and conflicting word–color pairs. |
| [Reaction Time Test](https://www.freefocusgames.com/games/reaction-time) | Wait for the screen to change color, then click or tap. Results show the response time recorded by your browser. |
| [Digit Span Test](https://www.freefocusgames.com/games/digit-span-test) | Recall visually presented digit sequences in forward or backward order as sequence length increases. |
| [Block Memory Challenge](https://www.freefocusgames.com/games/block-memory-challenge) | Recall sequences of highlighted blocks in forward or backward order, with adjustable practice and separate challenge leaderboards. |
| [Pomodoro Timer](https://www.freefocusgames.com/games/pomodoro-timer) | Alternate focused work sessions with breaks using a Pomodoro-style timer. |

Explore the [full game collection](https://www.freefocusgames.com/games) for more memory games, attention tasks, puzzles, and focus tools.

## 🎉 For Fun

- **[SBTI Test](https://www.freefocusgames.com/games/sbti-test)**: A playful, meme-style personality quiz with a shareable result poster.
- **[10-Second Challenge](https://www.freefocusgames.com/games/challenge-10-seconds)**: Stop the timer as close to 10 seconds as possible, with visible and hidden timer modes.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with the App Router and React 19
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI components**: [Radix UI](https://www.radix-ui.com/) and [shadcn/ui](https://ui.shadcn.com/)
- **Animation**: Motion and Canvas Confetti
- **Internationalization**: next-intl, with English and Chinese translations
- **Runtime and storage**: one Node.js process (`server.ts`) serving Next.js and a WebSocket room server, with SQLite (better-sqlite3); shipped as a Docker image

## 🚀 Getting Started

Use **Node.js 20 or later** and npm.

```bash
# Clone the repository and enter the project directory
git clone https://github.com/loethen/freefocusgames.git
cd freefocusgames

# Install dependencies from the lockfile
npm ci

# Start the development server
npm run dev
```

Open [http://localhost:3003](http://localhost:3003).

The development command runs `server.ts`, which starts Next.js (Turbopack) and the family room WebSocket on `/ws`. Data is stored in SQLite at `data/ekinos.db` (override with `DATABASE_PATH`); migrations in `drizzle/` are applied on startup.

```bash
npm run typecheck   # TypeScript
npm test            # server tests; the end-to-end suite needs `npm run build` first
```

## 👨‍👩‍👧 Ekinos family app

Turkish, account-based sessions ("oturum") where 2–8 family members play five random games in a row, at the same time, each on their own device: Sayı Avı, Hafıza Kartları, Büyük Hangisi?, Renk Tuzağı and Kutu Say. Each game awards rank points (first place gets one point per player); the session ends with the totals. Routes: `/kayit`, `/giris`, `/oyna`, `/katil`, `/oturum/KOD` (old `/oda/KOD` links redirect), `/profil`. The public site under `/` and `/zh` is unchanged.

- **Accounts**: username + password only (Argon2id hashes, HttpOnly session cookie). No e-mail.
- **Sessions**: in memory, in this single process. A restart ends running sessions (shown as "kesildi"); accounts, finished sessions and their rounds stay in SQLite. The code calls a session's group an "oda", since "oturum" already names login sessions.
- **Game pool**: `AILE_OYUN_HAVUZU=sayi-avi,kutu-say` limits which games sessions draw from (default: all five). With fewer than five, games repeat but never back to back.
- **Password reset**: there is no e-mail recovery. An operator issues a temporary password, which the user must change at next sign-in:
  `node dist/hesap-sifre-sifirla.js <username>` inside the container (`npm run hesap:sifre-sifirla -- <username>` in development).

### Running with Docker / Coolify

```bash
docker build -t ekinos .
docker run -p 3000:3000 -v ekinos-data:/data ekinos
```

- Mount a persistent volume at `/data` (holds `ekinos.db`); back it up like any SQLite file.
- Serve it over HTTPS behind the proxy and make sure WebSocket upgrades on `/ws` are passed through (Coolify's Traefik does this by default).
- `APP_ORIGIN` (e.g. `https://ekinos.example`) pins the allowed origin for sign-in and session requests; without it the forwarded `Host` is used.
- Run a single instance: sessions live in process memory.
- Plain-HTTP testing on a LAN needs `COOKIE_SECURE=false`, otherwise browsers drop the session cookie.

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.
*   ✅ Free to use for personal/educational purposes.
*   ✅ Free to fork and modify (changes must be open-sourced).
*   ❌ Cannot be used in closed-source proprietary software.

---
*Built with ❤️ for the cognitive science community.*
