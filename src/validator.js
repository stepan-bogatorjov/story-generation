/**
 * validator.js
 *
 * Validates the structured JSON story returned by the LLM.
 * Even though OpenAI Structured Outputs enforce a schema server-side,
 * we perform local validation as an additional safety net before
 * handing data to the image/video generation stages.
 *
 * Scene count is dynamic (the LLM chooses it based on pacing),
 * so we validate against a reasonable range and check that total
 * duration is approximately TARGET_DURATION seconds.
 */

import fs from "fs/promises";
import path from "path";

/**
 * Validates a parsed story object against the expected schema.
 *
 * Checks performed:
 *  1. Top-level object has a "title" string and "scenes" array.
 *  2. Scene count falls within [minScenes, maxScenes].
 *  3. Scene numbers start at 1 and are sequential.
 *  4. Every scene has a non-empty "prompt" string.
 *  5. Every scene has a numeric "duration".
 *  6. Total duration is approximately targetDuration (±20%).
 *
 * @param {object} story - Parsed story JSON.
 * @param {object} opts  - Validation options.
 * @param {number} opts.minScenes      - Minimum allowed scene count.
 * @param {number} opts.maxScenes      - Maximum allowed scene count.
 * @param {number} opts.targetDuration - Expected total duration in seconds.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStory(story, opts = {}) {
  const { minScenes = 5, maxScenes = 15, targetDuration = 60 } = opts;
  const errors = [];

  // 1. Top-level structure
  if (!story || typeof story !== "object") {
    return { valid: false, errors: ["Story must be a non-null object"] };
  }
  if (typeof story.title !== "string" || story.title.trim() === "") {
    errors.push("Missing or empty 'title' field");
  }
  if (typeof story.viralTitle !== "string" || story.viralTitle.trim() === "") {
    errors.push("Missing or empty 'viralTitle' field");
  } else if (story.viralTitle.length > 100) {
    errors.push(
      `'viralTitle' exceeds 100 characters (got ${story.viralTitle.length})`
    );
  }
  if (typeof story.description !== "string" || story.description.trim() === "") {
    errors.push("Missing or empty 'description' field");
  }
  if (!Array.isArray(story.scenes)) {
    errors.push("Missing 'scenes' array");
    return { valid: false, errors };
  }

  // 2. Scene count range
  if (story.scenes.length < minScenes || story.scenes.length > maxScenes) {
    errors.push(
      `Expected between ${minScenes} and ${maxScenes} scenes, got ${story.scenes.length}`
    );
  }

  // 3–5. Per-scene checks
  let totalDuration = 0;
  story.scenes.forEach((scene, index) => {
    const expectedNumber = index + 1;

    if (scene.scene !== expectedNumber) {
      errors.push(
        `Scene at index ${index}: expected scene number ${expectedNumber}, got ${scene.scene}`
      );
    }
    if (typeof scene.prompt !== "string" || scene.prompt.trim() === "") {
      errors.push(`Scene ${expectedNumber}: prompt is missing or empty`);
    }
    if (typeof scene.duration !== "number") {
      errors.push(`Scene ${expectedNumber}: duration must be a number`);
    } else {
      totalDuration += scene.duration;
    }
  });

  // 6. Total duration check (allow ±20% tolerance)
  const tolerance = targetDuration * 0.2;
  if (
    totalDuration < targetDuration - tolerance ||
    totalDuration > targetDuration + tolerance
  ) {
    errors.push(
      `Total duration ${totalDuration}s is outside the acceptable range ` +
        `(${targetDuration - tolerance}–${targetDuration + tolerance}s, target ${targetDuration}s)`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Saves the raw LLM response to disk for debugging when validation fails.
 *
 * @param {string} outputDir - Directory to write the debug file into.
 * @param {string} rawResponse - Raw text from the LLM.
 * @returns {Promise<string>} Path to the saved debug file.
 */
export async function saveRawResponse(outputDir, rawResponse) {
  await fs.mkdir(outputDir, { recursive: true });
  const debugPath = path.join(outputDir, "debug-raw-response.json");
  await fs.writeFile(debugPath, rawResponse, "utf-8");
  return debugPath;
}
