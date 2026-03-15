/**
 * validator.test.js
 *
 * Tests for the local JSON story validator.
 * Covers valid stories, missing fields, wrong counts, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { validateStory } from "../src/validator.js";

// Helper: returns a valid 3-scene story object.
function validStory(sceneCount = 3) {
  return {
    title: "Test Story",
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      scene: i + 1,
      prompt: `Scene ${i + 1} prompt`,
      duration: 4,
    })),
  };
}

describe("validateStory", () => {
  it("accepts a valid story", () => {
    const result = validateStory(validStory(3), 3);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null input", () => {
    const result = validateStory(null, 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-null object/);
  });

  it("rejects missing title", () => {
    const story = validStory(3);
    delete story.title;
    const result = validateStory(story, 3);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/title/));
  });

  it("rejects empty title", () => {
    const story = validStory(3);
    story.title = "   ";
    const result = validateStory(story, 3);
    expect(result.valid).toBe(false);
  });

  it("rejects missing scenes array", () => {
    const result = validateStory({ title: "Test" }, 3);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringMatching(/scenes/));
  });

  it("rejects wrong scene count", () => {
    const result = validateStory(validStory(2), 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Expected 3 scenes, got 2/);
  });

  it("rejects non-sequential scene numbers", () => {
    const story = validStory(3);
    story.scenes[1].scene = 5; // should be 2
    const result = validateStory(story, 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/expected scene number 2/);
  });

  it("rejects empty prompt", () => {
    const story = validStory(3);
    story.scenes[0].prompt = "";
    const result = validateStory(story, 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/prompt.*missing or empty/);
  });

  it("rejects non-numeric duration", () => {
    const story = validStory(3);
    story.scenes[2].duration = "four";
    const result = validateStory(story, 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/duration must be a number/);
  });

  it("validates the mock story file (7 scenes)", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const mockPath = path.resolve("mock/story.json");
    const story = JSON.parse(await fs.readFile(mockPath, "utf-8"));
    const result = validateStory(story, 7);
    expect(result.valid).toBe(true);
  });
});
