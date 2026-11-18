import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { engineRoot, readCourse, readCourseRegistry } from './course-config.mjs';
import { extensionsDir, importPi, piCli, runtime } from './windows-runtime.mjs';

const roleTools = {
  researcher: { extension: 'openai-research/index.ts', tools: ['web_search', 'web_fetch'] },
  'mermaid-maker': { extension: 'visual-tools/tools/mermaid_tools.ts', tools: ['read', 'write_mermaid', 'edit_mermaid', 'render_mermaid'] },
  'svg-maker': { extension: 'visual-tools/tools/svg_tools.ts', tools: ['read', 'write_svg', 'edit_svg', 'render_svg'] },
} as const;
type Role = keyof typeof roleTools;
const { parse } = createRequire(path.join(runtime, 'package.json'))('yaml');

function readRole(cwd: string, role: Role) {
  const local = path.join(cwd, '.pi', 'agents', `${role}.md`);
  const file = existsSync(local) ? local : path.join(engineRoot, '.pi', 'agents', `${role}.md`);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`Invalid role definition: ${role}`);
  const metadata = parse(match[1]);
  const separator = metadata.model.indexOf('/');
  if (separator < 1) throw new Error(`Missing provider in the ${role} model setting.`);
  const instructions = role === 'researcher'
    ? `${match[2]}\nOn Windows, use web_search and web_fetch for source discovery and reading.`
    : match[2];
  return { provider: metadata.model.slice(0, separator), model: metadata.model.slice(separator + 1), thinking: metadata.thinking, instructions };
}

export default function windowsLearning(pi: ExtensionAPI) {
  const active = new Map<string, { client: any; stop: () => Promise<void> }>();
  let generation = 0;

  pi.on('session_shutdown', async () => {
    generation++;
    const workers = [...active.values()];
    active.clear();
    await Promise.allSettled(workers.map(worker => worker.stop()));
  });

  pi.registerTool({
    name: 'subagent', label: 'Subagent',
    description: 'Start a researcher, mermaid-maker or svg-maker in a separate Windows process. Returns immediately. The finished result arrives automatically. Wait for it or do independent work. Do not poll or invent results.',
    parameters: Type.Object({
      agent: Type.Union([Type.Literal('researcher'), Type.Literal('mermaid-maker'), Type.Literal('svg-maker')]),
      task: Type.String({ minLength: 1 }),
      name: Type.Optional(Type.String()),
    }),
    async execute(id, { agent, task, name }, _signal, _update, ctx) {
      const role = roleTools[agent];
      const definition = readRole(ctx.cwd, agent);
      const { RpcClient } = await importPi('modes', 'rpc', 'rpc-client.js');
      const client = new RpcClient({
        cliPath: piCli, cwd: ctx.cwd, provider: definition.provider, model: definition.model,
        args: ['--offline', '--approve', '--no-session', '--no-extensions', '--no-skills', '--no-context-files',
          '--tools', role.tools.join(','), '--thinking', definition.thinking,
          '--system-prompt', definition.instructions, '-e', path.join(extensionsDir, role.extension)],
      });
      const label = `${name?.trim() || agent}-${id.slice(-6)}`;
      const startedIn = generation;
      let stopped: Promise<void> | undefined;
      let settle = () => {};
      const stop = () => {
        settle();
        return stopped ??= client.stop();
      };
      try {
        await client.start();
        if (generation !== startedIn) throw new Error('The parent session has closed.');
      } catch (error) {
        await stop();
        throw error;
      }
      active.set(label, { client, stop });
      void (async () => {
        let output: string;
        let status = 'completed';
        let final: any;
        const toolsUsed = new Set<string>();
        let publishedSvgPath: string | undefined;
        const settled = new Promise<void>(resolve => { settle = resolve; });
        const unsubscribe = client.onEvent((event: any) => {
          if (event.type === 'message_end' && event.message.role === 'assistant') final = event.message;
          if (event.type === 'tool_execution_end' && !event.isError) {
            toolsUsed.add(event.toolName);
            if (agent === 'svg-maker' && event.toolName === 'render_svg') {
              const render = event.result?.details;
              if (render?.ok && render.filename && typeof render.path === 'string') {
                publishedSvgPath = render.path;
              }
            }
          }
          if (event.type === 'agent_settled') settle();
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const run = async () => {
            const disposition = await client.prompt(task);
            if (disposition === 'handled') throw new Error('The worker did not start a model run.');
            await settled;
          };
          await Promise.race([run(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('The worker timed out.')), 300_000);
          })]);
          if (final?.stopReason !== 'stop') throw new Error(final?.errorMessage ?? 'The worker did not produce a final response.');
          output = final.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n');
          if (!output.trim()) throw new Error('The worker returned an empty response.');
        } catch (error) {
          status = 'failed';
          output = error instanceof Error ? error.message : String(error);
        } finally {
          clearTimeout(timer);
          unsubscribe();
          active.delete(label);
          await stop();
        }
        if (generation === startedIn) {
          const needsImageCheck = publishedSvgPath && (status === 'failed' || /RESULT:\s*NONE\b/i.test(output));
          const imageToCheck = needsImageCheck ? `\n\nPublished SVG render to check with read: ${publishedSvgPath}` : '';
          pi.sendMessage({ customType: 'subagent-result', content: `${label} (${status})\n\n${output}${imageToCheck}`, display: true,
            details: { agent, name: label, status, toolsUsed: [...toolsUsed] } }, { deliverAs: 'followUp', triggerTurn: true });
        }
      })().catch(error => {
        if (generation === startedIn) ctx.ui.notify(`子代理返回失败：${String(error)}`, 'error');
      });
      return { content: [{ type: 'text', text: `${label} started. Its result will arrive automatically.` }], details: { name: label } };
    },
  });

  pi.registerTool({
    name: 'subagents_list', label: 'Subagents', description: 'List available roles or running workers.',
    parameters: Type.Object({ scope: Type.Optional(Type.Union([Type.Literal('available'), Type.Literal('running')])) }),
    async execute(_id, { scope }) {
      const entries = scope === 'running' ? [...active.keys()] : Object.keys(roleTools);
      return { content: [{ type: 'text', text: entries.join('\n') || 'No running workers.' }], details: { entries } };
    },
  });

  pi.registerTool({
    name: 'subagent_message', label: 'Message subagent', description: 'Send a correction to a running worker by its returned name.',
    parameters: Type.Object({ name: Type.String(), message: Type.String() }),
    async execute(_id, { name, message }) {
      const worker = active.get(name);
      if (!worker) throw new Error(`No running worker named ${name}.`);
      const disposition = await worker.client.steer(message);
      return { content: [{ type: 'text', text: `Worker response: ${disposition}.` }], details: { disposition } };
    },
  });

  pi.registerCommand('learn', {
    description: '在 Windows Terminal 中打开另一门课程或章节',
    async handler(_args, ctx) {
      const courses = readCourseRegistry().courses;
      const selection = await ctx.ui.select('选择课程', courses.map(course => course.label));
      const course = courses.find(item => item.label === selection);
      if (!course) return;
      const route = readCourse(course.root);
      const chapter = await ctx.ui.select('选择章节', route.chapters.map(item => item.chapterTitle));
      if (!chapter) return;
      if (route.chapters.find(item => item.chapterTitle === chapter)?.sessionId === ctx.sessionManager.getSessionId()) {
        ctx.ui.notify('当前窗口已打开该章节。', 'info');
        return;
      }
      const child = spawn('wt.exe', ['--window', 'last', 'new-tab', '--title', `${route.courseTitle} · ${chapter}`,
        process.execPath, path.join(engineRoot, 'setup', 'start-menu.mjs'), '--course', course.id, '--chapter', chapter],
      { detached: true, stdio: 'ignore' });
      child.on('error', error => ctx.ui.notify(`无法打开章节：${error.message}`, 'error'));
      child.unref();
    },
  });
}
