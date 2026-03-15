/**
 * videoGenerator.js
 *
 * Generates scene videos using the Runway API (image-to-video).
 * Each video is created from the corresponding scene image that was
 * generated in the previous pipeline step, ensuring visual continuity.
 *
 * In MOCK_MODE the mock/video.mp4 file is copied for every scene instead.
 */

import fs from "fs/promises";
import path from "path";

/**
 * Generates videos for every scene in the story.
 *
 * @param {object}   config     - Pipeline configuration.
 * @param {object}   story      - Validated story object.
 * @param {string[]} imagePaths - Paths to generated scene images (one per scene).
 * @param {object}   [runway]   - Runway SDK client instance (required in production).
 * @returns {Promise<string[]>} Array of output video paths (one per scene).
 */
export async function generateVideos(config, story, imagePaths, runway) {
  console.log("[video] Step started: generating videos...");

  const videoPaths = [];

  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i];
    const sceneDir = path.join(
      config.SCENES_DIR,
      `scene-${String(scene.scene).padStart(2, "0")}`
    );
    await fs.mkdir(sceneDir, { recursive: true });
    const outputPath = path.join(sceneDir, "video.mp4");

    if (config.MOCK_MODE) {
      // -- Mock path: copy static video -------------------------------------
      console.log(
        `[video] MOCK_MODE — copying mock video for scene ${scene.scene}`
      );
      await fs.copyFile(config.MOCK_VIDEO_PATH, outputPath);
    } else {
      // -- Production path: call Runway image-to-video ----------------------
      if (!runway) {
        throw new Error("Runway client is required when MOCK_MODE is false");
      }

      console.log(`[video] Generating video for scene ${scene.scene}...`);

      // Read the previously generated scene image as base64 data URI.
      const imageBuffer = await fs.readFile(imagePaths[i]);
      const imageDataUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;

      // Create an image-to-video task and poll until completion.
      const task = await runway.imageToVideo.create({
        model: config.RUNWAY_MODEL,
        promptImage: imageDataUri,
        promptText: scene.prompt,
        duration: scene.duration,
        ratio: config.VIDEO_RATIO,
      });

      // Poll for task completion.
      let result = task;
      while (result.status !== "SUCCEEDED" && result.status !== "FAILED") {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        result = await runway.tasks.retrieve(result.id);
      }

      if (result.status === "FAILED") {
        throw new Error(
          `Runway video generation failed for scene ${scene.scene}: ${result.failure || "unknown error"}`
        );
      }

      // Download the generated video.
      const videoUrl = result.output[0];
      const response = await fetch(videoUrl);
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputPath, videoBuffer);
    }

    console.log(`[video] Scene ${scene.scene} video saved to ${outputPath}`);
    videoPaths.push(outputPath);
  }

  console.log("[video] Step completed.");
  return videoPaths;
}
