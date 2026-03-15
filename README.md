# Story Generation Pipeline

Automated pipeline for generating cinematic survival scenes using AI models.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
```

## Input Files

Place these in `input/`:
- `story-system.txt` — system prompt for story generation
- `reference.jpg` — reference image of the main character

## Commands

```bash
# Run tests (no API calls)
npm test

# Run pipeline in mock mode (no API calls)
npm run dev

# Run pipeline with real APIs (requires PRODUCTION_MODE=true in config)
npm run generate
```

## Architecture

1. **Story Generation** — OpenAI structured outputs produce a JSON story with scene prompts
2. **Image Generation** — OpenAI gpt-image-1 generates scene images using the reference character
3. **Video Generation** — Runway image-to-video creates clips from scene images

## Output

```
output/
  story.json
  scenes/
    scene-01/image.png, video.mp4
    scene-02/image.png, video.mp4
    ...
```

## Cost Control

By default `MOCK_MODE=true` — all API calls are replaced with local mock data.
Set `PRODUCTION_MODE=true` to enable real API calls.
