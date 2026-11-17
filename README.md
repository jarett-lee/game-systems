# game-systems

Reusable game systems. Not full games.

Each system comes with code and tests, an interactive Demo you can play with in the browser, and short Posts that explain how and why it works. This is a portfolio and a way of learning in public, so the writing explains the thinking behind each system rather than documenting an API.

## What's a system?

A **Game System** is a larger framework of several mechanics and game objects that feed into each other. A combat system (damage calculation, armor rules, weapon durability, stagger states), or an item shop with an upgrade path.

The rest of the project's words are defined in [GLOSSARY.md](GLOSSARY.md).

## Outputs

| Output | Where it goes |
|---|---|
| Code | This repo on GitHub. Copy what you need; there's no package to install. |
| Demos | A static site on GitHub Pages, one interactive Demo per system, with settings you can tweak. |
| Posts | X, Bluesky, YouTube Shorts, Instagram, dev.to, and a blog post on [jarett-lee.com](https://www.jarett-lee.com). |
| Publishing system | `publish/`, the tooling that makes and publishes the Posts for me. |

## Repo layout

```
systems/   one folder per system: its code, tests, and glossary
site/      the Demo site (GitHub Pages, also runs locally)
publish/   scripts that record videos and publish Posts
tools/     repo tooling, such as the no-comments lint rule
docs/adr/  decisions and why they were made
```

## How it's built

- **TypeScript** everywhere ([ADR 0003](docs/adr/0003-typescript-over-rust-wasm.md)).
- **Systems are logic only**: game state and rules over plain data, no rendering or input ([ADR 0002](docs/adr/0002-systems-are-logic-only.md)). That keeps them testable, portable to any engine, and easy to port to another language later.
- **No comments in code.** Names, types, and tests carry the meaning. If code needs a comment to be understood, rename it, extract it, encode it in a type, or cover it with a test. `npm run lint` enforces this with a local ESLint rule ([tools/eslint/no-comments.js](tools/eslint/no-comments.js)) that rejects every comment, including `eslint-disable` and `@ts-expect-error`, and inline ESLint config is turned off so it can't be bypassed. The writing about how and why a system works goes in its README and Posts instead.
- **The site** uses Vite, a canvas for visuals, and Tweakpane for each Demo's controls. It redeploys on every push to `main`.

## How a system ships

1. A new system is built on its own branch.
2. It's **built** once its code, tests, Demo, and Showreel (a scripted sequence that plays the Demo by itself) are merged to `main`.
3. The build then prepares drafts of every Post automatically: the Showreel recorded in vertical and landscape, a voiceover script, and the blog post, captions, hashtags, and keywords.
4. I record the voiceover. The scripts mix it in and add subtitles.
5. I preview everything, ask for edits, and confirm. Nothing is published without that.
6. Posts go out: automatically to Bluesky, YouTube Shorts, dev.to, and jarett-lee.com (the original of the blog post); X and Instagram are prepared for me to upload.

Later Posts about a system, for example after a big update, happen whenever I ask for them.

## The publishing system

Publishing is a Claude Code skill that runs small, rerunnable scripts in `publish/` ([ADR 0004](docs/adr/0004-publishing-is-a-claude-skill-over-scripts.md)). The scripts do the mechanical work (recording with Playwright, mixing with ffmpeg, subtitles with Whisper, uploading). Claude drafts the text and applies my edits.

- The text of every published Post is committed under `publish/posts/<system>/<date>/`. Video files stay out of git.
- Platform keys live in a local `.env` that is never committed. Publishing only runs on my machine.

## Status

Planning. No systems are built yet. The first one is in [systems/grid-placement](systems/grid-placement/README.md).

## License

[MIT](LICENSE)
