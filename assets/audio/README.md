# Graveyard music

Tracks listed in `tracks.json` play in shuffled order while visitors are in the Graveyard.
While the list is empty, the Graveyard plays an ambient soundscape generated in the browser.

## Add a track

1. Copy the audio file into this folder, e.g. `assets/audio/quiet-pivot.mp3`.
   MP3 or M4A (AAC) plays everywhere; OGG and Opus do not play in older Safari.
   Aim for 96–128 kbps and a few MB at most.
2. Add an entry to `tracks.json`:

```json
{
  "tracks": [
    {
      "file": "quiet-pivot.mp3",
      "title": "Quiet Pivot",
      "artist": "Someone Talented",
      "license": "CC BY 4.0",
      "source": "https://example.com/where-you-got-it",
      "credit": "“Quiet Pivot” by Someone Talented, CC BY 4.0"
    }
  ]
}
```

Only `file` is required. The Graveyard shows `credit` while the track plays, or `title — artist`
when `credit` is missing, so put any attribution your license requires in `credit`.
`license` and `source` are for your records.

Files can live in subfolders (`"file": "lofi/rainy-standup.mp3"`). A file that fails to load is skipped.

Only add music you have the right to use, and record its license in `site/ASSETS.md`.
