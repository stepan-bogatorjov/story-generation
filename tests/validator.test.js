/**
 * validator.test.js
 *
 * Tests for the local JSON story validator.
 * Covers valid stories, missing fields, wrong counts, duration checks, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { validateStory } from "../src/validator.js";

// Default validation options matching config defaults.
const defaultOpts = { minScenes: 5, maxScenes: 15, targetDuration: 60 };

// Helper: returns a valid story with the given scene count and per-scene duration.
function validStory(sceneCount = 9, perSceneDuration = null) {
  const dur = perSceneDuration ?? 60 / sceneCount;
  return {
    title: "Test Story",
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      scene: i + 1,
      prompt: `Scene ${i + 1} prompt`,
      duration: Math.round(dur * 10) / 10,
    })),
  };
}

describe("validateStory", () => {
  it("accepts a valid story", () => {
    const result = validateStory(validStory(9), defaultOpts);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null input", () => {
    const result = validateStory(null, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-null object/);
  });

  it("rejects missing title", () => {
    const story = validStory(9);
    delete story.title;
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/title/));
  });

  it("rejects empty title", () => {
    const story = validStory(9);
    story.title = "   ";
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(false);
  });

  it("rejects missing scenes array", () => {
    const result = validateStory({ title: "Test" }, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/scenes/));
  });

  it("rejects too few scenes", () => {
    const result = validateStory(validStory(3, 20), defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/between 5 and 15/);
  });

  it("rejects too many scenes", () => {
    const result = validateStory(validStory(20, 3), defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/between 5 and 15/);
  });

  it("rejects non-sequential scene numbers", () => {
    const story = validStory(9);
    story.scenes[1].scene = 5; // should be 2
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/expected scene number 2/);
  });

  it("rejects empty prompt", () => {
    const story = validStory(9);
    story.scenes[0].prompt = "";
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/prompt.*missing or empty/);
  });

  it("rejects non-numeric duration", () => {
    const story = validStory(9);
    story.scenes[2].duration = "four";
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringMatching(/duration must be a number/)
    );
  });

  it("rejects total duration too short", () => {
    // 9 scenes × 2s = 18s, way below 60s target
    const result = validateStory(validStory(9, 2), defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringMatching(/Total duration/)
    );
  });

  it("rejects total duration too long", () => {
    // 9 scenes × 12s = 108s, way above 60s target
    const result = validateStory(validStory(9, 12), defaultOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringMatching(/Total duration/)
    );
  });

  it("accepts duration within ±20% tolerance", () => {
    // 10 scenes × 5s = 50s → within 48–72 range
    const result = validateStory(validStory(10, 5), defaultOpts);
    expect(result.valid).toBe(true);
  });

  it("validates the mock story file", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const mockPath = path.resolve("mock/story.json");
    const story = JSON.parse(await fs.readFile(mockPath, "utf-8"));
    const result = validateStory(story, defaultOpts);
    expect(result.valid).toBe(true);
  });
});
