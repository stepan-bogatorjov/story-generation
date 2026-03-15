/**
 * story.test.js
 *
 * Tests for config loading, prompt loading, story generation (mock mode),
 * and image/video mock generation.
 */

import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";
import { loadConfig } from "../src/config.js";
import { loadSystemPrompt, loadReferenceImage } from "../src/promptLoader.js";
import { generateStory } from "../src/storyGenerator.js";

describe("loadConfig", () => {
  it("returns default config with MOCK_MODE true", () => {
    const config = loadConfig();
    expect(config.MOCK_MODE).toBe(true);
    expect(config.PRODUCTION_MODE).toBe(false);
    expect(config.SCENE_COUNT).toBe(7);
  });

  it("accepts overrides", () => {
    const config = loadConfig({ SCENE_COUNT: 3, MOCK_MODE: false });
    expect(config.SCENE_COUNT).toBe(3);
    expect(config.MOCK_MODE).toBe(false);
  });

  it("returns a frozen object", () => {
    const config = loadConfig();
    expect(() => {
      config.MOCK_MODE = false;
    }).toThrow();
  });
});

describe("promptLoader", () => {
  it("loads system prompt text", async () => {
    const config = loadConfig();
    const prompt = await loadSystemPrompt(config.SYSTEM_PROMPT_PATH);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("loads reference image as base64 data URI", async () => {
    const config = loadConfig();
    const dataUri = await loadReferenceImage(config.REFERENCE_IMAGE_PATH);
    expect(dataUri).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("generateStory (mock mode)", () => {
  it("loads and validates mock story", async () => {
    const config = loadConfig();
    const story = await generateStory(config);
    expect(story.title).toBeTruthy();
    expect(story.scenes).toHaveLength(7);
    expect(story.scenes[0].scene).toBe(1);
    expect(story.scenes[6].scene).toBe(7);
  });

  it("saves story to output directory", async () => {
    const outputDir = path.resolve("output");
    const config = loadConfig({ OUTPUT_DIR: outputDir });
    await generateStory(config);
    const saved = JSON.parse(
      await fs.readFile(path.join(outputDir, "story.json"), "utf-8")
    );
    expect(saved.title).toBeTruthy();
  });
});
