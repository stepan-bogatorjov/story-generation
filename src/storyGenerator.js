/**
 * storyGenerator.js
 *
 * Generates a structured survival story using the OpenAI API.
 * In MOCK_MODE the story is loaded from a local JSON file instead.
 *
 * The LLM is called with OpenAI Structured Outputs (response_format)
 * so the response is guaranteed to conform to a strict JSON schema.
 */

import fs from "fs/promises";
import { loadSystemPrompt } from "./promptLoader.js";
import { validateStory, saveRawResponse } from "./validator.js";

// ---------------------------------------------------------------------------
// JSON Schema used by OpenAI Structured Outputs (strict mode)
// ---------------------------------------------------------------------------

/**
 * Builds the JSON schema definition passed to response_format.
 *
 * @param {number} sceneCount - The required number of scenes
 *   (used in the description only; enforcement is done locally).
 * @returns {object} OpenAI response_format parameter value.
 */
function buildResponseFormat(sceneCount) {
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
          scenes: {
            type: "array",
            description: `Exactly ${sceneCount} cinematic scenes`,
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
        required: ["title", "scenes"],
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

  if (config.MOCK_MODE) {
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
          content: `Generate a cinematic survival story with exactly ${config.SCENE_COUNT} scenes. Each scene must have a sequential scene number starting from 1, a full cinematic visual prompt, and a duration in seconds.`,
        },
      ],
      response_format: buildResponseFormat(config.SCENE_COUNT),
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
  const { valid, errors } = validateStory(story, config.SCENE_COUNT);

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
  console.log("[story] Step completed.");

  return story;
}
