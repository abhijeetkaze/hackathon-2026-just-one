// Gemma on the phone, through WebLLM (WebGPU). Loaded from a CDN at runtime, so the app has
// no build step; the service worker caches the module and WebLLM caches the weights itself.

import { pickGemmaModel } from "../domain/extract.js";

export const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2";

let lib = null;
const loadLib = () => (lib ??= import(WEBLLM_URL));

async function supportsF16() {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error("This browser has WebGPU but no usable GPU.");
  return adapter.features.has("shader-f16");
}

/** Why the AI step can't run here, or "" if it can. The manual form works either way. */
export function unsupportedReason() {
  if (!("gpu" in navigator)) return "This browser can't run Gemma (no WebGPU). Use Chrome on Android or desktop, or fill the form by hand.";
  return "";
}

export function gemma() {
  let engine = null;
  let modelId = null;

  async function chooseModel() {
    if (modelId) return modelId;
    const m = await loadLib();
    const ids = m.prebuiltAppConfig.model_list.map((x) => x.model_id);
    modelId = pickGemmaModel(ids, { supportsF16: await supportsF16() });
    if (!modelId) throw new Error("No suitable Gemma build is available for this device.");
    return modelId;
  }

  return {
    async isCached() {
      try {
        const m = await loadLib();
        return await m.hasModelInCache(await chooseModel());
      } catch {
        return false;
      }
    },

    /** Downloads (once) and starts Gemma. onProgress gets 0..1. */
    async load(onProgress = () => {}) {
      if (engine) return;
      const m = await loadLib();
      const id = await chooseModel();
      engine = await m.CreateMLCEngine(id, { initProgressCallback: (p) => onProgress(p.progress ?? 0) });
    },

    async complete(prompt, opts = {}) {
      if (!engine) throw new Error("Gemma isn't loaded yet.");
      const reply = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: opts.maxTokens ?? 900,
      });
      return reply.choices[0]?.message?.content ?? "";
    },

    get modelId() {
      return modelId;
    },
  };
}
