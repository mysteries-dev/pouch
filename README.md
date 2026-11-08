<p align="center">
  <img src="./assets/icon.png" alt="Pouch" width="96" height="96" />
</p>

<h1 align="center">Pouch</h1>

<p align="center">
  <b>Offline-first money tracking for students.</b><br />
  Log an expense in three seconds, split it with your roommates, and audit the month — no budget templates, no cloud account.
</p>

<p align="center">
  <a href="https://github.com/mysteries-dev/pouch/actions/workflows/build-apk.yml"><img src="https://github.com/mysteries-dev/pouch/actions/workflows/build-apk.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React%20Native-0.88.1-61DAFB?logo=react&logoColor=white" alt="React Native 0.88.1" /></a>
  <a href="https://docs.expo.dev/versions/latest/sdk/sqlite/"><img src="https://img.shields.io/badge/SQLite-expo--sqlite-003B57?logo=sqlite&logoColor=white" alt="SQLite via expo-sqlite" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

---

## Overview

Pouch is a **micro-finance tracker built for students**, where money moves in unpredictable bursts rather than neat monthly cycles.

Most personal-finance apps want you to declare a budget up front — a fixed allowance split into envelopes, reviewed on a schedule. That model breaks down for student life, where income arrives randomly and spending spikes around events like a semester move, a group trip, or a broken laptop.

Pouch drops the upfront budget entirely. You log money as it actually moves, tag it to whatever is happening right now, and settle up with roommates as you go. At the end of the month you get an honest picture of where it went — not a plan you failed to keep.

**Everything is stored locally in SQLite.** There is no account, no server sync, and no network dependency in the core app: your ledger stays on your device and keeps working on a plane, in a hostel, or on a dorm Wi-Fi connection that dropped out.

## Core Features

### ⚡ 3-Second Micro-Logger
A single modal, a numeric keypad, and you are done. Open the logger, punch in an amount, pick a category, save. The path from "I just bought lunch" to "it's recorded" is deliberately short, so logging stays a habit instead of a chore. Recent entries appear in a day-grouped feed — `Today`, `Yesterday`, `Tuesday`, `Nov 8`.

### 💰 Flexible "Money In"
Income is not a salary line. Log money in on any day it arrives — a part-time shift, a transfer from home, a friend paying you back, a scholarship installment. There is no assumed pay cycle and no required frequency; a random Tuesday with nothing in is perfectly valid.

### 🏷️ Custom Event Tags
Attach free-form tags to any entry to group spending by what was actually happening: `#ApartmentMove`, `#ExamWeek`, `#RoadTrip`. Categories answer *"what kind of spend was this?"*; tags answer *"what was going on?"* — and the end-of-month audit rolls up by both.

### 🤝 Roommate Debt Matrix
Shared costs leave IOUs behind, and Pouch tracks them explicitly:

- **They Owe** — you fronted the money, someone owes you.
- **I Owe** — you borrowed, you owe them.

Each debt carries a person's name, an amount, and a status. A running net line phrased from your point of view — `You owe Tk 1,200.00`, `They owe you Tk 800.00`, or `All settled up 🎉` — keeps the picture clear, and **one tap marks a debt settled**. Settling keeps the history rather than deleting it, so the record of what happened survives.

### 📊 End-of-Month Audit & Local CSV Export
Pick a month and see how it actually went: income against spending, a category breakdown, and a tag-by-tag view of what drove the month. Export the lot as a spreadsheet-ready CSV — `Date,Type,Category,Amount,Tag,Note` — written to local storage and handed to your device's share sheet.

The export is UTF-8 encoded with a BOM and CRLF line endings, so Bangla notes open correctly in Excel instead of turning into mojibake, and the file lands wherever you want it: a cloud drive, an email to yourself, or a local folder. No data leaves the device unless you share it.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React Native](https://reactnative.dev/) `0.88.1` |
| Runtime & tooling | [Expo](https://expo.dev/) SDK `58` (`~58.0.23`) |
| Language | [TypeScript](https://www.typescriptlang.org/) `~6.0.3` |
| Storage | [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/) `~58.0.15` — local SQLite database |
| State | [Zustand](https://zustand.docs.pmnd.rs/) `^5.1.0` |
| Routing | [Expo Router](https://docs.expo.dev/router/introduction/) |

The app targets **Taka (Tk)** as its display currency throughout the UI.

## Download & Installation

The standalone Android APK is published on the **[Releases](https://github.com/mysteries-dev/pouch/releases)** page.

1. Open **[github.com/mysteries-dev/pouch/releases](https://github.com/mysteries-dev/pouch/releases)**.
2. Under the latest release, find the asset named `pouch-v<version>.apk`.
3. Download it to your Android device.
4. Open the file. If your browser warns that the app is from an unknown source, allow installs from your file manager or browser when prompted (this is standard for any APK installed outside the Play Store).
5. Launch **Pouch**.

> **Note:** the APK is built and signed by the [GitHub Actions workflow](./.github/workflows/build-apk.yml) on every version tag, so each release's binary corresponds to the source at that tag. It is a sideload build — you can also build it yourself from source below.

### Building a release APK yourself

```bash
git clone https://github.com/mysteries-dev/pouch.git
cd pouch
npm install
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleRelease
```

The output lands in `android/app/build/outputs/apk/release/`.

## Local Setup & Development

Requires **Node.js 22 or newer** (Expo SDK 58's supported range) and the [Expo Go](https://expo.dev/go) app on your phone to preview instantly.

```bash
git clone https://github.com/mysteries-dev/pouch.git
cd pouch
npm install
npx expo start
```

Scan the QR code with Expo Go on Android, or press `a` to open an Android emulator.

| Command | What it does |
| --- | --- |
| `npx expo start` | Start the Metro dev server |
| `npm run android` | Open the app on an Android device/emulator |
| `npm run ios` | Open the app on an iOS device/simulator (macOS only) |
| `npm run web` | Run the app in a browser |
| `npx expo lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting |
| `npx expo-doctor` | Diagnose dependency and config issues |

The native `android/` and `ios/` directories are **generated**, not committed — they are produced on demand by `npx expo prebuild` from `app.json` and the config plugins. Edit `app.json` rather than the generated native files.

### Project structure

```
src/
├── app/          Expo Router routes (_layout, index, debts, summary)
├── screens/      Home, Debts and Summary screens
├── components/   FastLoggerModal, DebtCard, CategoryBreakdown, …
├── store/        Zustand finance store
├── db/           SQLite schema, queries and client
├── utils/        Money/date formatting and CSV export
└── theme.ts      Shared colours and spacing
```

### Releases

Pushing a tag matching `v*` triggers the **Build Android APK** workflow, which type-checks, generates the native project, compiles a release APK, and attaches it to a GitHub Release for that tag.

```bash
git tag v1.0.1
git push origin v1.0.1
```

---

Released under the [MIT License](./LICENSE).
