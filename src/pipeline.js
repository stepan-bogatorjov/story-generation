/**
 * pipeline.js
 *
 * Orchestrates the full story-generation pipeline:
 *   1. Generate (or load) the survival story.
 *   2. Generate scene images.
 *   3. Generate scene videos.
 *
 * Each step saves its output to disk and logs progress.
 * The pipeline respects MOCK_MODE / PRODUCTION_MODE flags from config.
 */

import { generateStory } from "./storyGenerator.js";
import { generateImages } from "./imageGenerator.js";
import { generateVideos } from "./videoGenerator.js";

/**
 * Runs the complete generation pipeline.
 *
 * @param {object}  config  - Pipeline configuration (from config.js).
 * @param {object}  [deps]  - External dependencies injected by the caller.
 * @param {object}  [deps.openai]  - OpenAI client (required in production).
 * @param {object}  [deps.runway]  - Runway client (required in production).
 * @returns {Promise<{ story: object, imagePaths: string[], videoPaths: string[] }>}
 */
export async function runPipeline(config, deps = {}) {
  console.log("=== Pipeline started ===");
  console.log(`  MOCK_MODE:       ${config.MOCK_MODE}`);
  console.log(`  PRODUCTION_MODE: ${config.PRODUCTION_MODE}`);
  console.log(`  SCENE_COUNT:     ${config.SCENE_COUNT}`);

  // Safety guard: real API calls require PRODUCTION_MODE to be explicitly true.
  if (!config.MOCK_MODE && !config.PRODUCTION_MODE) {
    throw new Error(
      "PRODUCTION_MODE must be true to make real API calls. " +
        "Set MOCK_MODE=true for development or PRODUCTION_MODE=true for production."
    );
  }

  // Step 1 — Story generation
  const story = await generateStory(config, deps.openai);

  // Step 2 — Image generation
  const imagePaths = await generateImages(config, story, deps.openai);

  // Step 3 — Video generation
  const videoPaths = await generateVideos(config, story, imagePaths, deps.runway);

  console.log("=== Pipeline completed ===");

  return { story, imagePaths, videoPaths };
}
