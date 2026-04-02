/**
 * config.js
 *
 * Central configuration for the story-generation pipeline.
 * Controls mock/production mode, scene count, model selection,
 * and directory paths used throughout the application.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * Returns the full pipeline configuration object.
 *
 * @param {object} [overrides] - Optional partial config to merge on top of defaults.
 * @returns {object} Frozen configuration object.
 */
export function loadConfig(overrides = {}) {
  const config = {
    // -- Mode flags ----------------------------------------------------------
    // MOCK_MODE: when true, no external API calls are made; mock data is used.
    MOCK_MODE: true,
    // PRODUCTION_MODE: must be explicitly true to allow real API calls.
    PRODUCTION_MODE: false,
    // REUSE_STORY: when true, skip story generation and load existing output/story.json.
    REUSE_STORY: false,
    // REUSE_IMAGES: when true, skip image generation and use existing scene images.
    REUSE_IMAGES: false,

    // -- Story settings ------------------------------------------------------
    // Scene count is determined dynamically by the LLM based on pacing.
    // These bounds are used for local validation only.
    MIN_SCENES: 5,
    MAX_SCENES: 15,
    TARGET_DURATION: 60,

    // -- Model identifiers ---------------------------------------------------
    OPENAI_MODEL: "gpt-5.4",
    OPENAI_IMAGE_MODEL: "gpt-image-1",
    RUNWAY_MODEL: "gen4.5",
    VIDEO_RATIO: "720:1280",

    // -- Directory paths -----------------------------------------------------
    INPUT_DIR: path.join(ROOT_DIR, "input"),
    OUTPUT_DIR: path.join(ROOT_DIR, "output"),
    MOCK_DIR: path.join(ROOT_DIR, "mock"),
    SCENES_DIR: path.join(ROOT_DIR, "output", "scenes"),

    // -- Input file paths ----------------------------------------------------
    SYSTEM_PROMPT_PATH: path.join(ROOT_DIR, "input", "story-system.txt"),
    REFERENCE_IMAGE_PATH: path.join(ROOT_DIR, "input", "reference.jpg"),

    // -- Mock file paths -----------------------------------------------------
    MOCK_STORY_PATH: path.join(ROOT_DIR, "mock", "story.json"),
    MOCK_IMAGE_PATH: path.join(ROOT_DIR, "mock", "image.png"),
    MOCK_VIDEO_PATH: path.join(ROOT_DIR, "mock", "video.mp4"),

    // Apply any caller-supplied overrides last.
    ...overrides,
  };

  return Object.freeze(config);
}
