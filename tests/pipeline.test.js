/**
 * pipeline.test.js
 *
 * Integration tests for the full pipeline and production-mode safety guards.
 * All tests run in MOCK_MODE — no external API calls are made.
 */

import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { loadConfig } from "../src/config.js";
import { runPipeline } from "../src/pipeline.js";
import { generateImages } from "../src/imageGenerator.js";
import { generateVideos } from "../src/videoGenerator.js";

// Use the real output directory; mock mode writes safe placeholder files.
function testConfig(overrides = {}) {
  return loadConfig({
    OUTPUT_DIR: path.resolve("output"),
    SCENES_DIR: path.resolve("output/scenes"),
    ...overrides,
  });
}

describe("pipeline — mock mode", () => {
  it("runs the full pipeline in mock mode", async () => {
    const config = testConfig();
    const result = await runPipeline(config);

    expect(result.story.title).toBeTruthy();
    expect(result.imagePaths.length).toBe(result.story.scenes.length);
    expect(result.videoPaths.length).toBe(result.story.scenes.length);

    // Verify files were created on disk.
    for (const p of [...result.imagePaths, ...result.videoPaths]) {
      const stat = await fs.stat(p);
      expect(stat.size).toBeGreaterThan(0);
    }
  });
});

describe("pipeline — production safety guards", () => {
  it("throws if MOCK_MODE=false and PRODUCTION_MODE=false", async () => {
    const config = testConfig({
      MOCK_MODE: false,
      PRODUCTION_MODE: false,
    });
    await expect(runPipeline(config)).rejects.toThrow(/PRODUCTION_MODE/);
  });

  it("throws if OpenAI client missing in production mode", async () => {
    const config = testConfig({
      MOCK_MODE: false,
      PRODUCTION_MODE: true,
    });
    // Pipeline will call generateStory without an openai client.
    await expect(runPipeline(config, {})).rejects.toThrow(/OpenAI client/);
  });
});

describe("imageGenerator — mock mode", () => {
  it("copies mock images for each scene", async () => {
    const config = testConfig();
    const story = JSON.parse(
      await fs.readFile(config.MOCK_STORY_PATH, "utf-8")
    );
    const paths = await generateImages(config, story);
    expect(paths).toHaveLength(story.scenes.length);
    for (const p of paths) {
      expect(p).toMatch(/image\.png$/);
    }
  });
});

describe("videoGenerator — mock mode", () => {
  it("copies mock videos for each scene", async () => {
    const config = testConfig();
    const story = JSON.parse(
      await fs.readFile(config.MOCK_STORY_PATH, "utf-8")
    );
    const imagePaths = story.scenes.map((s) =>
      path.join(
        config.SCENES_DIR,
        `scene-${String(s.scene).padStart(2, "0")}`,
        "image.png"
      )
    );
    const paths = await generateVideos(config, story, imagePaths);
    expect(paths).toHaveLength(story.scenes.length);
    for (const p of paths) {
      expect(p).toMatch(/video\.mp4$/);
    }
  });
});
