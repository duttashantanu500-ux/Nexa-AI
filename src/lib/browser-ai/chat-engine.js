import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let generatorPromise;

function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = pipeline(
      "text2text-generation",
      "Xenova/LaMini-Flan-T5-783M",
      { dtype: "q8" }
    );
  }
  return generatorPromise;
}

export async function generateBrowserResponse({ systemPrompt, messages }) {
  const generator = await getGenerator();
  const conversation = messages
    .filter(({ role }) => role !== "system")
    .map(({ role, content }) => `${role === "user" ? "User" : "Nexa Intelligence"}: ${content}`)
    .join("\n");
  const prompt = `${systemPrompt}\n\nRespond only as Nexa Intelligence.\n\n${conversation}\nNexa Intelligence:`;
  const output = await generator(prompt, { max_new_tokens: 256, do_sample: true, temperature: 0.7 });
  return output?.[0]?.generated_text?.slice(prompt.length).trim() || "I could not generate a response. Please try again.";
}