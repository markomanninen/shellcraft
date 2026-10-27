# Documentation Index

Every document in this repository, and when to read it.

## Start Here

| Document | Read it when you want to |
|---|---|
| [README.md](README.md) | know what shellcraft is and run something in five minutes |
| [GETTING_STARTED.md](GETTING_STARTED.md) | set up step by step, or something does not work |
| [VISUAL_DEMO.md](VISUAL_DEMO.md) | see the screens before you run anything |

## Build an App

| Document | Read it when you want to |
|---|---|
| [USAGE_GUIDE.md](USAGE_GUIDE.md) | add screens, use components, handle keys, add APIs, an LLM or a database, deploy |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | look up a command, a component, a key or an env variable |
| [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) | follow the screen rules, and understand Ink over SSH |
| [ui/README.md](ui/README.md) | know every component prop, the theme tokens, `serve()`, `renderLocal()` and the test helpers |
| [TESTING_SUMMARY.md](TESTING_SUMMARY.md) | write or run tests |

## Understand the Project

| Document | Read it when you want to |
|---|---|
| [COMPLETE_OVERVIEW.md](COMPLETE_OVERVIEW.md) | see the four parts and what each demo app teaches |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | find which file does what |
| [COMPARISON.md](COMPARISON.md) | compare the demo apps feature by feature |

## Each App

| Document | About |
|---|---|
| [demo-shop/README.md](demo-shop/README.md) | the shop, the reference app |
| [adventure-game/README.md](adventure-game/README.md) | the text RPG and its LLM layer |
| [admin-dashboard/README.md](admin-dashboard/README.md) | the system dashboard |
| [animation-demo/README.md](animation-demo/README.md) | the animations |

A generated app has its own `README.md`, and `vendor/ui/README.md`.

## Project

| Document | About |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | workflow, coding standards, tests, pull requests |
| [SECURITY.md](SECURITY.md) | security policy and reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | community rules |
| [LICENSE](LICENSE) | MIT |

## Reading Paths

- **Just run it (10 minutes):** README → `./init.sh my-app` → QUICK_REFERENCE.
- **Build a product (1 hour):** README → USAGE_GUIDE → DESIGN_PRINCIPLES → ui/README.
- **Learn SSH terminal UIs (2 hours):** generate an app and read its code
  next to USAGE_GUIDE, then DESIGN_PRINCIPLES (Ink over SSH) and the
  demo apps.

## Quick Links

- Generate an app: `./init.sh my-app`
- Run the reference app: `cd demo-shop && ./npmw install && ./npmw run generate-keys && ./npmw start`
- Connect: `ssh localhost -p 2222`
- Design: [Figma file](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc)
