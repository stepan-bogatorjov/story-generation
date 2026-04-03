/**
 * imageGenerator.js
 *
 * Generates scene images using the OpenAI gpt-image-1 model.
 * The reference character image is passed alongside the scene prompt
 * so the model preserves the character's appearance across all scenes.
 *
 * All scenes are generated in parallel for faster throughput.
 * In MOCK_MODE the mock/image.png file is copied for every scene instead.
 */

import fs from "fs/promises";
import path from "path";
import { toFile } from "openai";

/**
 * Generates images for every scene in the story (in parallel).
 *
 * @param {object}   config   - Pipeline configuration.
 * @param {object}   story    - Validated story object (title + scenes[]).
 * @param {object}   [openai] - OpenAI client instance (required in production).
 * @returns {Promise<string[]>} Array of output image paths (one per scene).
 */
export async function generateImages(config, story, openai) {
  console.log("[image] Step started: generating images...");

  if (config.REUSE_IMAGES) {
    console.log("[image] REUSE_IMAGES — using existing scene images");
    const imagePaths = story.scenes.map((scene) =>
      path.join(
        config.SCENES_DIR,
        `scene-${String(scene.scene).padStart(2, "0")}`,
        "image.png"
      )
    );
    console.log("[image] Step completed.");
    return imagePaths;
  }

  // Load reference image once for all scenes.
  let referenceFile;
  if (!config.MOCK_MODE) {
    if (!openai) {
      throw new Error("OpenAI client is required when MOCK_MODE is false");
    }
    referenceFile = await toFile(
      await fs.readFile(config.REFERENCE_IMAGE_PATH),
      "reference.jpg",
      { type: "image/jpeg" }
    );
  }

  const tasks = story.scenes.map(async (scene) => {
    const sceneDir = path.join(
      config.SCENES_DIR,
      `scene-${String(scene.scene).padStart(2, "0")}`
    );
    await fs.mkdir(sceneDir, { recursive: true });
    const outputPath = path.join(sceneDir, "image.png");

    if (config.MOCK_MODE) {
      console.log(
        `[image] MOCK_MODE — copying mock image for scene ${scene.scene}`
      );
      await fs.copyFile(config.MOCK_IMAGE_PATH, outputPath);
    } else {
      console.log(`[image] Generating image for scene ${scene.scene}...`);

      const response = await openai.images.edit({
        model: config.OPENAI_IMAGE_MODEL,
        image: [referenceFile],
        prompt: scene.prompt,
        n: 1,
        size: "1536x1024",
      });

      const base64Data = response.data[0].b64_json;
      const imageBuffer = Buffer.from(base64Data, "base64");
      await fs.writeFile(outputPath, imageBuffer);
    }

    console.log(`[image] Scene ${scene.scene} image saved to ${outputPath}`);
    return outputPath;
  });

  const results = await Promise.allSettled(tasks);
  const imagePaths = [];
  const failed = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      imagePaths.push(result.value);
    } else {
      const sceneNum = story.scenes[i].scene;
      console.error(`[image] Scene ${sceneNum} FAILED: ${result.reason.message}`);
      failed.push(sceneNum);
      imagePaths.push(null);
    }
  });

  if (failed.length > 0) {
    console.warn(`[image] ${failed.length} scene(s) failed: ${failed.join(", ")}`);
  }

  console.log("[image] Step completed.");
  return imagePaths;
}
