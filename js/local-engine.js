// Local LLM Engine — WebLLM (WebGPU) with Transformers.js fallback
// ES module that exports to window for existing global scripts.

const LOCAL_MODELS_CONFIG = {
  'qwen2.5-0.5b': {
    label: 'Qwen2.5-0.5B',
    size: '310 MB',
    webllm: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    transformers: 'onnx-community/Qwen2.5-0.5B-Instruct-INT4-ONNX',
    context: 2048,
  },
  'qwen2.5-1.5b': {
    label: 'Qwen2.5-1.5B',
    size: '950 MB',
    webllm: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    transformers: 'onnx-community/Qwen2.5-1.5B-Instruct-INT4-ONNX',
    context: 4096,
  },
};

let engineType = null;       // 'webllm' | 'transformers'
let engineInstance = null;   // WebLLM CreateMLCEngine or Transformers.js pipeline
let loadedModelKey = null;   // key from LOCAL_MODELS_CONFIG
let isModelLoading = false;

function isLoaded() {
  return engineInstance !== null && !!engineType;
}

function getEngineType() {
  return engineType;
}

function getLoadedModelKey() {
  return loadedModelKey;
}

function getIsModelLoading() {
  return isModelLoading;
}

async function checkWebGPU() {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {}
  }
  return false;
}

async function loadModel(modelKey, onProgress) {
  if (isModelLoading) throw new Error('Model is already loading');
  if (engineInstance) await unloadModel();

  const config = LOCAL_MODELS_CONFIG[modelKey];
  if (!config) throw new Error('Unknown model: ' + modelKey);

  isModelLoading = true;
  loadedModelKey = modelKey;

  const hasWebGPU = await checkWebGPU();

  try {
    if (hasWebGPU) {
      engineType = 'webllm';
      if (onProgress) onProgress({ phase: 'download', progress: 0, text: 'Initializing WebLLM...' });

      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      if (onProgress) onProgress({ phase: 'download', progress: 0.1, text: 'Downloading model weights...' });

      engineInstance = await CreateMLCEngine(config.webllm, {
        initProgressCallback: (report) => {
          if (onProgress && report.text) {
            const pct = report.progress || 0;
            onProgress({
              phase: report.text.includes('Loading') ? 'loading' : 'download',
              progress: pct,
              text: report.text,
            });
          }
        },
      });
    } else {
      engineType = 'transformers';
      if (onProgress) onProgress({ phase: 'download', progress: 0, text: 'Initializing Transformers.js...' });

      const { pipeline } = await import('@huggingface/transformers');
      if (onProgress) onProgress({ phase: 'download', progress: 0.3, text: 'Loading model into memory...' });

      engineInstance = await pipeline('text-generation', config.transformers, {
        dtype: 'q4',
        device: 'wasm',
        progress_callback: (p) => {
          if (onProgress && typeof p === 'object' && p.status) {
            onProgress({
              phase: 'download',
              progress: p.progress || 0,
              text: p.status || 'Loading...',
            });
          }
        },
      });
    }

    if (onProgress) onProgress({ phase: 'ready', progress: 1, text: 'Model ready' });
  } catch (err) {
    engineType = null;
    engineInstance = null;
    loadedModelKey = null;
    isModelLoading = false;
    throw err;
  }

  isModelLoading = false;
}

async function unloadModel() {
  if (engineInstance) {
    try {
      if (engineType === 'webllm' && typeof engineInstance.unload === 'function') {
        await engineInstance.unload();
      }
    } catch {}
    engineInstance = null;
  }
  engineType = null;
  loadedModelKey = null;
  isModelLoading = false;
}

function buildLocalSystemPrompt(baseSystemPrompt, tools) {
  let prompt = baseSystemPrompt || 'You are a helpful AI assistant.';
  if (tools && tools.length > 0) {
    prompt += '\n\nYou have access to the following tools. When you need to use a tool, respond with EXACTLY one tool call per line using this format:\n[TOOL_CALL: tool_name(param1="value1", param2="value2")]\n\n';
    prompt += tools.map(t => {
      const func = t.function;
      const params = func.parameters?.properties || {};
      const required = func.parameters?.required || [];
      const paramStr = Object.entries(params).map(([k, v]) => {
        const isReq = required.includes(k);
        return '  ' + k + (isReq ? ' (required)' : '') + ': ' + (v.description || '');
      }).join('\n');
      return 'Tool: ' + func.name + '\n  Description: ' + (func.description || '') + (paramStr ? '\n  Parameters:\n' + paramStr : '\n  Parameters: none');
    }).join('\n\n');
    prompt += '\n\nIMPORTANT: Call at most one tool per response. You will receive the result and can then call another tool or give your final answer. Once you have enough information, provide your final answer without tool calls.';
  }
  return prompt;
}

function parseToolCalls(text) {
  const calls = [];
  const regex = /\[TOOL_CALL:\s*(\w+)\s*\(([\s\S]*?)\)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    const argsStr = match[2].trim();
    const args = {};
    if (argsStr) {
      const argRegex = /(\w+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+))/g;
      let argMatch;
      while ((argMatch = argRegex.exec(argsStr)) !== null) {
        const val = argMatch[2] !== undefined ? argMatch[2].replace(/\\"/g, '"') :
                    argMatch[3] !== undefined ? argMatch[3].replace(/\\'/g, "'") :
                    argMatch[4];
        args[argMatch[1]] = val;
      }
    }
    calls.push({ name, arguments: JSON.stringify(args) });
  }
  return calls;
}

async function* chatCompletion(messages, tools) {
  if (!engineInstance) throw new Error('No model loaded');

  const config = LOCAL_MODELS_CONFIG[loadedModelKey];
  const contextLimit = config ? config.context : 2048;
  const maxTokens = Math.floor(contextLimit * 0.5);

  // Build messages with tool injection
  const localMessages = messages.map(m => ({ role: m.role, content: m.content }));

  if (tools && tools.length > 0 && localMessages.length > 0 && localMessages[0].role === 'system') {
    localMessages[0] = {
      role: 'system',
      content: buildLocalSystemPrompt(localMessages[0].content, tools),
    };
  }

  if (engineType === 'webllm') {
    const asyncChunkGenerator = await engineInstance.chat.completions.create({
      messages: localMessages,
      stream: true,
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    let fullText = '';
    for await (const chunk of asyncChunkGenerator) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        yield { type: 'delta', content, fullText };
      }
    }

    // Check for tool calls in the accumulated response
    const toolCalls = parseToolCalls(fullText);
    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls, fullText };
    } else {
      yield { type: 'done', content: fullText };
    }
  } else {
    // Transformers.js — no streaming
    const text = engineInstance.tokenizer.apply_chat_template(localMessages, {
      tokenize: false,
      add_generation_prompt: true,
    });

    const output = await engineInstance(text, {
      max_new_tokens: maxTokens,
      do_sample: true,
      temperature: 0.7,
    });

    const generatedText = output[0]?.generated_text || '';
    const response = generatedText.slice(text.length).trim();

    // Yield the full response at once (no streaming)
    yield { type: 'delta', content: response, fullText: response };

    const toolCalls = parseToolCalls(response);
    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls, fullText: response };
    } else {
      yield { type: 'done', content: response };
    }
  }
}

async function* chatCompletionStream(messages, tools, onToolCall) {
  const gen = chatCompletion(messages, tools);
  let fullText = '';

  for await (const result of gen) {
    if (result.type === 'delta') {
      fullText = result.fullText;
      yield result.content;
    } else if (result.type === 'tool_calls') {
      if (onToolCall) {
        for (const tc of result.toolCalls) {
          yield null; // signal tool call to sender
          onToolCall(tc);
        }
      }
    } else if (result.type === 'done') {
      yield null; // done
    }
  }

  return fullText;
}

// Export to global scope for non-module scripts
window.__localEngine = {
  LOCAL_MODELS_CONFIG,
  loadModel,
  unloadModel,
  chatCompletion,
  chatCompletionStream,
  isLoaded,
  getEngineType,
  getLoadedModelKey,
  getIsModelLoading,
  checkWebGPU,
  buildLocalSystemPrompt,
  parseToolCalls,
};
