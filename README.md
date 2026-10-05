# FRAKTUM TCG

Competitive card-game branch focused on the playable core.

## Product focus

The first release intentionally keeps the structure small:

- Arena
- Inventory / collection / deck building
- Market
- Shop
- Clubs
- Profile
- Settings

Clubs are limited to the product areas we actually need for the first version: club chat, club wars and club cards.

The previous hub, runtime map editor, exploration layer and story-world implementation are not part of this branch. The full pre-simplification version is preserved in the `backup/full-world-hub` branch so those systems can be restored later without blocking the card game.

## Development

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm test
```

## Branches

- `core/card-game-only` — current stripped-down competitive version.
- `backup/full-world-hub` — snapshot of the full hub/world/editor version before simplification.
- `main` — left unchanged while the new direction is validated.
