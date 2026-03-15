/**
 * main.js
 *
 * Entry point for the story-generation pipeline.
 * Reads environment variables, builds configuration, initialises API clients,
 * and kicks off the pipeline.
 *
 * Usage:
 *   node src/main.js             → runs in MOCK_MODE (default, safe for dev)
 *   node src/main.js --production → runs with real API calls
 */

import "dotenv/config";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";

async function main() {
  const isProduction = process.argv.includes("--production");

  const config = loadConfig({
    MOCK_MODE: !isProduction,
    PRODUCTION_MODE: isProduction,
  });

  const deps = {};

  // Only create API clients when we actually need them.
  if (!config.MOCK_MODE) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    if (!process.env.RUNWAY_API_KEY) {
      throw new Error("RUNWAY_API_KEY environment variable is not set");
    }

    const { default: OpenAI } = await import("openai");
    deps.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { default: RunwayML } = await import("@runwayml/sdk");
    deps.runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });
  }

  await runPipeline(config, deps);
}

main().catch((err) => {
  console.error("Pipeline failed:", err.message);
  process.exit(1);
});
