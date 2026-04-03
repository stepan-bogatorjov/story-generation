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

import path from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";
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
  console.log(`  TARGET_DURATION: ${config.TARGET_DURATION}s`);

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

  // Step 4 — Archive output
  const archivePath = await archiveOutput(config);

  console.log("=== Pipeline completed ===");

  return { story, imagePaths, videoPaths, archivePath };
}

/**
 * Packs the entire output directory into a timestamped zip archive.
 *
 * @param {object} config - Pipeline configuration.
 * @returns {Promise<string>} Path to the created zip file.
 */
function archiveOutput(config) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipName = `story-${timestamp}.zip`;
    const zipPath = path.join(config.OUTPUT_DIR, zipName);

    console.log(`[archive] Packing output to ${zipPath}...`);

    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[archive] Archive created (${(archive.pointer() / 1024 / 1024).toFixed(1)} MB)`);
      resolve(zipPath);
    });

    archive.on("error", reject);
    archive.pipe(output);

    // Add story.json and scenes/, but exclude any existing zip archives.
    archive.file(path.join(config.OUTPUT_DIR, "story.json"), { name: "story.json" });
    archive.directory(path.join(config.OUTPUT_DIR, "scenes"), "scenes");

    archive.finalize();
  });
}
