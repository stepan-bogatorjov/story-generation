/**
 * promptLoader.js
 *
 * Loads external input assets from disk:
 *   - The system prompt text (story-system.txt)
 *   - The reference character image (reference.jpg) as a base64 data-URI
 *
 * These files are expected inside the input/ directory.
 */

import fs from "fs/promises";

/**
 * Reads the system prompt text file.
 *
 * @param {string} promptPath - Absolute path to story-system.txt.
 * @returns {Promise<string>} The trimmed prompt text.
 */
export async function loadSystemPrompt(promptPath) {
  const text = await fs.readFile(promptPath, "utf-8");
  return text.trim();
}

/**
 * Reads the reference image and returns a base64-encoded data URI
 * suitable for inclusion in OpenAI vision messages.
 *
 * @param {string} imagePath - Absolute path to reference.jpg.
 * @returns {Promise<string>} Base64 data URI (e.g. "data:image/jpeg;base64,...").
 */
export async function loadReferenceImage(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const base64 = buffer.toString("base64");
  return `data:image/jpeg;base64,${base64}`;
}
