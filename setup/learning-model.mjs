import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const learningProvider = 'openai-codex';
export const learningModel = 'gpt-6.2-sol';
export const learningThinking = 'xhigh';
export const learningModelArgs = ['--model', `${learningProvider}/${learningModel}`, '--thinking', learningThinking];

// Pi 1.4.0 predates this model. Use Codex's context window and supported
// reasoning levels, with OpenAI's published output limit and prices.
const codexSol = {
  id: learningModel,
  name: 'GPT-6.2 Sol',
  api: 'openai-codex-responses',
  reasoning: true,
  input: ['text', 'image'],
  contextWindow: 500_000,
  maxTokens: 128_000,
  thinkingLevelMap: { off: null, minimal: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  cost: {
    input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5,
    tiers: [{ inputTokensAbove: 272_000, input: 4, output: 15, cacheRead: 0.2, cacheWrite: 5 }],
  },
  compat: {
    supportsOpenAIGrammarTools: true, supportsAdditionalTools: true,
    supportsToolSearch: true, supportsMidConvoSystemMessages: true,
  },
  inputLimits: { images: { resize: { maxWidth: 2000, maxHeight: 2000, maxBytes: 4718592, jpegQuality: 80 } } },
};

export function installLearningModel(agentDir) {
  const filename = path.join(agentDir, 'models.json');
  const current = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '{}';
  const config = JSON.parse(current.replace(/^\uFEFF/, ''));
  const provider = (config.providers ??= {})[learningProvider] ??= {};
  const models = provider.models ??= [];
  if (models.some(model => model.id === learningModel)) return;
  models.push(codexSol);
  fs.mkdirSync(agentDir, { recursive: true });
  const staged = `${filename}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(staged, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(staged, filename);
  } finally {
    fs.rmSync(staged, { force: true });
  }
}

export async function loadLearningModel(runtime, agentDir) {
  installLearningModel(agentDir);
  const core = path.join(runtime, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'core');
  const [{ ModelRuntime }, { ModelRegistry }] = await Promise.all([
    import(pathToFileURL(path.join(core, 'model-runtime.js')).href),
    import(pathToFileURL(path.join(core, 'model-registry.js')).href),
  ]);
  const models = new ModelRegistry(await ModelRuntime.create({
    authPath: path.join(agentDir, 'auth.json'),
    modelsPath: path.join(agentDir, 'models.json'),
  }));
  const model = models.find(learningProvider, learningModel);
  if (!model) throw new Error(models.getError() ?? 'Configured model is absent from Pi catalog.');
  return { models, model };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.PI_CODING_AGENT_DIR) throw new Error('Missing Pi agent directory.');
  installLearningModel(process.env.PI_CODING_AGENT_DIR);
}
