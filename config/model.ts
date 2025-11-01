import { createGroq } from "@ai-sdk/groq";
import { validateEnv } from "@daydreamsai/core";
import { z } from "zod";

/**
 * Validates and loads environment variables
 */
export const env = validateEnv(
    z.object({
        GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
    })
);

/**
 * Initializes the Groq client for LLM interactions
 */
export const groq = createGroq({
    apiKey: env.GROQ_API_KEY!
});

