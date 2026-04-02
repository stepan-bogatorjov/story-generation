/**
 * imageGenerator.js
 *
 * Generates scene images using the OpenAI gpt-image-1 model.
 * The reference character image is passed alongside the scene prompt
 * so the model preserves the character's appearance across all scenes.
 *
 * In MOCK_MODE the mock/image.png file is copied for every scene instead.
 */

import fs from "fs/promises";
import path from "path";
import { toFile } from "openai";

/**
 * Generates images for every scene in the story.
 *
 * @param {object}   config   - Pipeline configuration.
 * @param {object}   story    - Validated story object (title + scenes[]).
 * @param {object}   [openai] - OpenAI client instance (required in production).
 * @returns {Promise<string[]>} Array of output image paths (one per scene).
 */
export async function generateImages(config, story, openai) {
  console.log("[image] Step started: generating images...");

  const imagePaths = [];

  if (config.REUSE_IMAGES) {
    console.log("[image] REUSE_IMAGES — using existing scene images");
    for (const scene of story.scenes) {
      const sceneDir = path.join(
        config.SCENES_DIR,
        `scene-${String(scene.scene).padStart(2, "0")}`
      );
      imagePaths.push(path.join(sceneDir, "image.png"));
    }
    console.log("[image] Step completed.");
    return imagePaths;
  }

  for (const scene of story.scenes) {
    const sceneDir = path.join(
      config.SCENES_DIR,
      `scene-${String(scene.scene).padStart(2, "0")}`
    );
    await fs.mkdir(sceneDir, { recursive: true });
    const outputPath = path.join(sceneDir, "image.png");

    if (config.MOCK_MODE) {
      // -- Mock path: copy static image -------------------------------------
      console.log(
        `[image] MOCK_MODE — copying mock image for scene ${scene.scene}`
      );
      await fs.copyFile(config.MOCK_IMAGE_PATH, outputPath);
    } else {
      // -- Production path: call OpenAI images.generate ---------------------
      if (!openai) {
        throw new Error("OpenAI client is required when MOCK_MODE is false");
      }

      console.log(`[image] Generating image for scene ${scene.scene}...`);

      const response = await openai.images.edit({
        model: config.OPENAI_IMAGE_MODEL,
        image: [
          await toFile(
            await fs.readFile(config.REFERENCE_IMAGE_PATH),
            "reference.jpg",
            { type: "image/jpeg" }
          ),
        ],
        prompt: scene.prompt,
        n: 1,
        size: "1536x1024",
      });

      // The API returns base64-encoded image data.
      const base64Data = response.data[0].b64_json;
      const imageBuffer = Buffer.from(base64Data, "base64");
      await fs.writeFile(outputPath, imageBuffer);
    }

    console.log(`[image] Scene ${scene.scene} image saved to ${outputPath}`);
    imagePaths.push(outputPath);
  }

  console.log("[image] Step completed.");
  return imagePaths;
}
