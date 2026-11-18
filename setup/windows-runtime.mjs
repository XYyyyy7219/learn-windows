import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { engineRoot } from './course-config.mjs';
import { learningModelArgs } from './learning-model.mjs';

export const runtime = path.join(engineRoot, '.runtime');
export const agentDir = path.join(engineRoot, '.private', 'agent-windows');
export const piModule = (...parts) => path.join(runtime, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', ...parts);
export const piCli = piModule('bundle', 'cli.js');
export const importPi = (...parts) => import(pathToFileURL(piModule(...parts)).href);
export const extensionsDir = path.join(engineRoot, '.pi', 'extensions');

function systemProxy() {
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  const { stdout } = spawnSync('reg.exe', ['query', key], { encoding: 'utf8', windowsHide: true });
  if (!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(stdout ?? '')) return;
  const address = stdout.match(/ProxyServer\s+REG_SZ\s+(?:http:\/\/)?(127\.0\.0\.1:\d+|localhost:\d+)\s*$/im)?.[1];
  if (address) return `http://${address}`;
}

export function windowsEnvironment() {
  const preload = path.join(engineRoot, 'setup', 'node-proxy.cjs').replaceAll('\\', '/');
  const env = {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir,
    LEARN_PI_RUNTIME_DIR: runtime,
    LEARN_VISUAL_DEPS_DIR: path.join(extensionsDir, 'visual-tools'),
    LEARN_WEB_DEPS_DIR: path.join(runtime, 'web-tools'),
    PYTHONPATH: [path.join(runtime, 'pdf-tools'), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require "${preload}"`].filter(Boolean).join(' '),
    NODE_USE_SYSTEM_CA: '1',
    NO_PROXY: ['localhost', '127.0.0.1', '::1', process.env.NO_PROXY].filter(Boolean).join(','),
  };
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || systemProxy();
  if (proxy) {
    env.HTTP_PROXY ||= proxy;
    env.HTTPS_PROXY ||= proxy;
  }
  return env;
}

const parentExtensions = [
  'ask-user-question.ts', 'md-log.ts', 'openai-research/index.ts', 'quiz.ts',
];
const parentTools = [
  'read', 'powershell', 'edit', 'write', 'grep', 'find', 'ls',
  'quiz', 'ask_user_question', 'web_search', 'web_fetch', 'subagent', 'subagents_list', 'subagent_message',
];

export function nativePiArgs(root, chapter, { selectModel = true } = {}) {
  if (!existsSync(piCli)) throw new Error('Windows 版 Pi 未安装。请先运行 Install-Windows.cmd。');
  const args = ['--offline', '--no-extensions', '--tools', parentTools.join(',')];
  if (selectModel) args.push(...learningModelArgs);
  if (root !== engineRoot) args.push('--skill', path.join(engineRoot, '.pi', 'skills'));
  for (const filename of parentExtensions) args.push('-e', path.join(extensionsDir, filename));
  args.push('-e', path.join(engineRoot, 'setup', 'windows-learning.ts'));
  const context = [
    '本会话运行在 Windows。通过 powershell 执行本地命令。教材位置见当前课程的 Materials.md。',
    'Python 和 PyMuPDF 可用时，可读取本地 PDF 文本并渲染扫描页。',
    '需要切换课程或章节时，可在普通输入框使用 /learn。',
  ];
  if (chapter.contextFile) {
    // Add the same course context the Linux launcher passes to Pi.
    args.push('--append-system-prompt', path.join(root, chapter.contextFile));
  }
  args.push('--append-system-prompt', context.join('\n'));
  return args;
}
