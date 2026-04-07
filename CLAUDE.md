# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js must be in PATH — if `npm` is not found in bash, prepend `export PATH="$PATH:/c/Program Files/nodejs" &&` to the command.

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:5173
npm run build      # type-check + production build
npm run preview    # preview production build
```

## Stack

- **Vite 6** + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin (no `tailwind.config.js`); styles live in `src/index.css` as `@import "tailwindcss"`
- **Supabase JS v2** — client library installed, not yet initialized

## Architecture

Currently a skeleton. Entry point: `src/main.tsx` → `src/App.tsx`. All styles go through `src/index.css`.

Tailwind v4 differs from v3: configuration is done in CSS (via `@theme`, `@layer`, etc.) rather than in a JS config file.

## Conventions

- React components go in `src/components/`
- Game state goes in `src/store/`
- Variable and file names in English; comments in Polish
- Do not install new UI libraries without asking the user first
