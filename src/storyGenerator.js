/**
 * storyGenerator.js
 *
 * Generates a structured survival story using the OpenAI API.
 * In MOCK_MODE the story is loaded from a local JSON file instead.
 *
 * The LLM is called with OpenAI Structured Outputs (response_format)
 * so the response is guaranteed to conform to a strict JSON schema.
 *
 * Scene count is determined dynamically by the LLM based on pacing
 * and a ~60-second target duration. The schema enforces the shape
 * of each scene but not the array length.
 */

import fs from "fs/promises";
import { loadSystemPrompt } from "./promptLoader.js";
import { validateStory, saveRawResponse } from "./validator.js";

// ---------------------------------------------------------------------------
// JSON Schema used by OpenAI Structured Outputs (strict mode)
// ---------------------------------------------------------------------------

/**
 * Builds the JSON schema definition passed to response_format.
 * The schema enforces the shape of the story object but does NOT
 * constrain the number of scenes — the LLM decides that dynamically.
 *
 * @returns {object} OpenAI response_format parameter value.
 */
function buildResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "survival_story",
      strict: true,
      schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the survival story",
          },
          viralTitle: {
            type: "string",
            description:
              "Short, catchy, viral English title for social media (YouTube/TikTok/Reels). " +
              "Must grab attention, create curiosity or urgency. Max 100 characters.",
          },
          description: {
            type: "string",
            description:
              "Engaging English description for social media. " +
              "Hook the viewer in the first line, include relevant hashtags. 2-4 sentences.",
          },
          scenes: {
            type: "array",
            description:
              "Dynamic number of cinematic scenes totalling ~60 seconds",
            items: {
              type: "object",
              properties: {
                scene: {
                  type: "integer",
                  description: "Sequential scene number starting from 1",
                },
                prompt: {
                  type: "string",
                  description:
                    "Full cinematic prompt describing the scene visually",
                },
                duration: {
                  type: "number",
                  description: "Duration in seconds for the video clip",
                },
              },
              required: ["scene", "prompt", "duration"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "viralTitle", "description", "scenes"],
        additionalProperties: false,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Story generation
// ---------------------------------------------------------------------------

/**
 * Generates a survival story.
 *
 * In MOCK_MODE the story is loaded from mock/story.json.
 * In PRODUCTION_MODE the OpenAI API is called with structured output.
 *
 * @param {object}   config       - Pipeline configuration (from config.js).
 * @param {object}   [openai]     - OpenAI client instance (required in production).
 * @returns {Promise<object>} Parsed and validated story object.
 */
export async function generateStory(config, openai) {
  console.log("[story] Step started: generating story...");

  let story;

  if (config.REUSE_STORY) {
    // -- Reuse path: load previously generated story from output -------------
    const reusePath = `${config.OUTPUT_DIR}/story.json`;
    console.log(`[story] REUSE_STORY — loading existing story from ${reusePath}`);
    const raw = await fs.readFile(reusePath, "utf-8");
    story = JSON.parse(raw);
  } else if (config.MOCK_MODE) {
    // -- Mock path: read story from disk ------------------------------------
    console.log(`[story] MOCK_MODE — loading story from ${config.MOCK_STORY_PATH}`);
    const raw = await fs.readFile(config.MOCK_STORY_PATH, "utf-8");
    story = JSON.parse(raw);
  } else {
    // -- Production path: call OpenAI API -----------------------------------
    if (!openai) {
      throw new Error("OpenAI client is required when MOCK_MODE is false");
    }

    const systemPrompt = await loadSystemPrompt(config.SYSTEM_PROMPT_PATH);

    console.log("[story] Calling OpenAI API with structured output...");

    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Generate a cinematic survival story. Determine the number of scenes dynamically " +
            "based on pacing and action density. The total duration of all scenes must be " +
            "approximately 60 seconds. Each scene must have a sequential scene number starting " +
            "from 1, a full cinematic visual prompt, and a duration in seconds. " +
            "Also provide a viral English title (viralTitle) — short, catchy, attention-grabbing " +
            "for YouTube/TikTok/Reels (max 100 chars), and an engaging English description " +
            "with a hook and relevant hashtags (2-4 sentences).",
        },
      ],
      response_format: buildResponseFormat(),
    });

    const rawContent = response.choices[0].message.content;

    try {
      story = JSON.parse(rawContent);
    } catch {
      // Save raw output for debugging, then bail out.
      const debugPath = await saveRawResponse(config.OUTPUT_DIR, rawContent);
      throw new Error(
        `Failed to parse LLM response as JSON. Raw response saved to ${debugPath}`
      );
    }
  }

  // -- Local validation (runs in both modes) --------------------------------
  const { valid, errors } = validateStory(story, {
    minScenes: config.MIN_SCENES,
    maxScenes: config.MAX_SCENES,
    targetDuration: config.TARGET_DURATION,
  });

  if (!valid) {
    const debugPath = await saveRawResponse(
      config.OUTPUT_DIR,
      JSON.stringify(story, null, 2)
    );
    throw new Error(
      `Story validation failed:\n  - ${errors.join("\n  - ")}\nRaw response saved to ${debugPath}`
    );
  }

  // -- Persist validated story ----------------------------------------------
  const outputPath = `${config.OUTPUT_DIR}/story.json`;
  await fs.mkdir(config.OUTPUT_DIR, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(story, null, 2), "utf-8");
  console.log(`[story] Story saved to ${outputPath}`);
  console.log(`[story] Scene count: ${story.scenes.length}`);
  console.log(
    `[story] Total duration: ${story.scenes.reduce((s, sc) => s + sc.duration, 0)}s`
  );
  console.log("[story] Step completed.");

  return story;
}
