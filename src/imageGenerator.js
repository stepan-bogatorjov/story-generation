/**
 * imageGenerator.js
 *
 * Generates scene images using the OpenAI images.edit API.
 * The reference character image (input/reference.jpg) is passed as the
 * input image with input_fidelity="high" so the model preserves the
 * character's face, clothing, beard, and equipment across all scenes.
 *
 * In MOCK_MODE the mock/image.png file is copied for every scene instead.
 */

import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";

/**
 * Generates images for every scene in the story.
 *
 * Uses images.edit (not images.generate) so we can supply the reference
 * image as input. Setting input_fidelity to "high" tells the model to
 * preserve distinctive features — face, clothing, gear — from the
 * reference across every generated scene.
 *
 * @param {object}   config   - Pipeline configuration.
 * @param {object}   story    - Validated story object (title + scenes[]).
 * @param {object}   [openai] - OpenAI client instance (required in production).
 * @returns {Promise<string[]>} Array of output image paths (one per scene).
 */
export async function generateImages(config, story, openai) {
  console.log("[image] Step started: generating images...");

  const imagePaths = [];

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
      // -- Production path: call OpenAI images.edit -------------------------
      if (!openai) {
        throw new Error("OpenAI client is required when MOCK_MODE is false");
      }

      console.log(`[image] Generating image for scene ${scene.scene}...`);

      // Pass the reference image as the input so the model keeps the
      // character's appearance consistent. input_fidelity="high" preserves
      // facial features, clothing, and other distinctive details.
      const response = await openai.images.edit({
        model: config.OPENAI_IMAGE_MODEL,
        image: createReadStream(config.REFERENCE_IMAGE_PATH),
        prompt: scene.prompt,
        n: 1,
        size: "1536x1024",
        input_fidelity: "high",
        quality: "high",
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
