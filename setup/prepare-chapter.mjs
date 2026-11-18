import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {workspaceFromArgs,readCourse,argumentValue} from './course-config.mjs';
import {learningProvider,learningModel,learningThinking} from './learning-model.mjs';

const root=workspaceFromArgs();
const config=readCourse(root);
const args=process.argv.slice(2);
const requested=argumentValue(args,'--chapter')??(args[0]&&!args[0].startsWith('--')?args[0]:config.chapterTitle);
const chapter=config.chapters.find(c=>c.chapterTitle===requested);
assert(chapter,'Unknown chapter.');
const runtime=process.env.LEARN_PI_RUNTIME_DIR;
const agent=process.env.PI_CODING_AGENT_DIR;
assert(runtime&&agent,'Missing runtime paths.');
const {SessionManager,getDefaultSessionDir}=await import(pathToFileURL(path.join(runtime,'node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js')).href);
const group=getDefaultSessionDir(root,agent);
const matches=fs.readdirSync(group).filter(name=>name.endsWith(`_${chapter.sessionId}.jsonl`));
assert(matches.length<=1,'Ambiguous chapter session ID.');
const log=path.join(root,chapter.logFile);
if(!fs.existsSync(log)){
  fs.writeFileSync(log,`# ${config.courseTitle} · ${chapter.chapterTitle}\n\n`,{encoding:'utf8',flag:'wx'});
}
assert(fs.statSync(log).isFile(),'Chapter reading log must exist.');
let file,created=false;
if(matches.length){
  file=path.join(group,matches[0]);
}else{
  const manager=SessionManager.create(root,group,{id:chapter.sessionId});
  manager.appendModelChange(learningProvider,learningModel);
  manager.appendThinkingLevelChange(learningThinking);
  manager.appendSessionInfo(chapter.chapterTitle);
  manager.appendCustomEntry('md-log',{file:log});
  file=manager.getSessionFile();
  // Pi normally delays writing setup-only sessions until the first conversation.
  // Save this requested empty chapter explicitly, using SDK-generated records only.
  // No student answer, assistant lesson or model request is manufactured.
  const records=[manager.getHeader(),...manager.getEntries()];
  fs.writeFileSync(file,records.map(record=>JSON.stringify(record)).join('\n')+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  created=true;
}
const readback=SessionManager.open(file);
assert.equal(readback.getSessionId(),chapter.sessionId);
assert.equal(readback.getSessionName(),chapter.chapterTitle);
const entries=readback.getEntries();
const link=entries.filter(e=>e.type==='custom'&&e.customType==='md-log').at(-1);
assert.equal(link?.data?.file,log);
const messageCount=entries.filter(e=>e.type==='message').length;
if(created)assert.equal(messageCount,0);
console.log(JSON.stringify({created,messageCount,sessionId:chapter.sessionId}));
