import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {engineRoot,readCourseRegistry,readCourse,argumentValue} from './course-config.mjs';
import {agentDir,importPi,nativePiArgs,piCli,runtime,windowsEnvironment} from './windows-runtime.mjs';
import {installLearningModel,learningModel,learningThinking} from './learning-model.mjs';

const args=process.argv.slice(2),registry=readCourseRegistry();
let selectedId=argumentValue(args,'--course');
const interactiveMenu=!selectedId&&!args.includes('--check');
if(args.includes('--list')){
  console.log(JSON.stringify(registry.courses.map(({id,label})=>({id,label})),null,2));
  process.exit(0);
}
if(!selectedId&&!args.includes('--check')){
  console.log('\nAI 物理学习 | 选择课程\n');
  registry.courses.forEach((course,index)=>console.log(`  ${index+1}. ${course.label}${course.id===registry.defaultCourseId?'（默认）':''}`));
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  try{
    while(!selectedId){
      const answer=(await rl.question('\n输入编号，直接回车进入默认课程，q 退出：')).trim();
      if(answer.toLowerCase()==='q')process.exit(0);
      if(!answer)selectedId=registry.defaultCourseId;
      else if(/^\d+$/.test(answer))selectedId=registry.courses[Number(answer)-1]?.id;
      else selectedId=registry.courses.find(course=>course.id===answer)?.id;
      if(!selectedId)console.log('请选择上面列出的课程编号。');
    }
  }finally{rl.close();}
}
selectedId??=registry.defaultCourseId;
const selected=registry.courses.find(course=>course.id===selectedId);
if(!selected)throw new Error(`Unknown course: ${selectedId}`);
const root=selected.root,course=readCourse(root);
let chapterTitle=argumentValue(args,'--chapter');
if (!chapterTitle && interactiveMenu && course.chapters.length>1) {
  console.log(`\n${selected.label}`);
  course.chapters.forEach((chapter,index)=>console.log(`  ${index+1}. ${chapter.chapterTitle}${chapter.chapterTitle===course.chapterTitle?'（默认）':''}`));
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  try {
    while (!chapterTitle) {
      const answer=(await input.question('\n选择章节，回车进入默认章节，q 退出：')).trim();
      if (answer.toLowerCase()==='q') process.exit(0);
      chapterTitle=answer ? course.chapters[Number(answer)-1]?.chapterTitle : course.chapterTitle;
      if (!chapterTitle) console.log('请选择上面列出的章节编号。');
    }
  } finally {
    input.close();
  }
}
chapterTitle??=course.chapterTitle;
const chapter=course.chapters.find(item=>item.chapterTitle===chapterTitle);
if (!chapter) throw new Error(`Unknown chapter: ${chapterTitle}`);

function openReader(filename) {
  const uri='obsidian://open?path='+encodeURIComponent(filename);
  const reader=spawn('explorer.exe',[uri],{detached:true,stdio:'ignore',windowsHide:true});
  reader.on('error',()=>console.log(`可在 Obsidian 手动打开 ${filename}`));
  reader.unref();
}

async function runNative() {
  if (!fs.existsSync(piCli)) throw new Error('请先运行 Install-Windows.cmd 安装依赖。');
  const env=windowsEnvironment();
  const {SessionManager,getDefaultSessionDir}=await importPi('core','session-manager.js');
  const sessionDir=getDefaultSessionDir(root,agentDir);
  let sessionFile=SessionManager.findById(root,chapter.sessionId,sessionDir);
  if (args.includes('--check')) {
    console.log(JSON.stringify({courseId:selected.id,course:course.courseTitle,chapter:chapterTitle,sessionId:chapter.sessionId,
      launcher:'windows-native',windowsRoot:root,sessionFound:!!sessionFile,model:learningModel,thinking:learningThinking,passed:true}));
    return;
  }
  installLearningModel(agentDir);
  fs.mkdirSync(sessionDir,{recursive:true});
  const {lock}=createRequire(path.join(runtime,'package.json'))('proper-lockfile');
  const lockPath=path.join(sessionDir,chapter.sessionId);
  const release=await lock(lockPath,{realpath:false}).catch(error=>{
    if(error.code==='ELOCKED') throw new Error(`${course.courseTitle} ${chapterTitle} 已在另一个窗口打开。`);
    throw error;
  });
  try {
    if (!sessionFile) {
      const preparation=spawnSync(process.execPath,[path.join(engineRoot,'setup','prepare-chapter.mjs'),'--workspace',root,'--chapter',chapterTitle],
        {env,encoding:'utf8',windowsHide:true});
      if(preparation.status!==0) throw new Error(preparation.stderr||preparation.error?.message||'无法建立章节会话。');
      sessionFile=SessionManager.findById(root,chapter.sessionId,sessionDir);
    }
    if (!sessionFile) throw new Error('找不到章节会话。');
    console.log(`${course.courseTitle} · ${chapterTitle} | Windows 原生`);
    const {ReadOnlyAuthStorage}=await importPi('core','auth-storage.js');
    const credentials=await new ReadOnlyAuthStorage(path.join(agentDir,'auth.json')).list();
    const hasCodexLogin=credentials.some(credential=>credential.providerId==='openai-codex');
    if (!hasCodexLogin) console.log('首次使用请在 Pi 中输入 /login，选择账号登录和 OpenAI Codex。');
    const launchArgs=nativePiArgs(root,chapter,{selectModel:hasCodexLogin});
    const note=path.join(root,`${chapterTitle}.md`);
    if (!args.includes('--no-obsidian')) openReader(fs.existsSync(note)?note:path.join(root,chapter.logFile));
    process.on('SIGINT',()=>{});
    const child=spawn(process.execPath,[piCli,...launchArgs,'--approve','--session',sessionFile,'--name',chapterTitle],{cwd:root,env,stdio:'inherit'});
    process.exitCode=await new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('exit',code=>resolve(code??1));
    });
  } finally {
    await release();
  }
}

try {
  await runNative();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
