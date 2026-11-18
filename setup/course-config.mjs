import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const engineRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function argumentValue(args,name){
  const index=args.indexOf(name);
  if(index<0)return undefined;
  const value=args[index+1];
  if(!value||value.startsWith('--'))throw new Error(`Missing value for ${name}`);
  return value;
}
export function courseWorkspace(value=engineRoot){
  const root=path.resolve(engineRoot,value),relative=path.relative(engineRoot,root);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error('Course workspace must be inside the learning library.');
  return root;
}
export function workspaceFromArgs(args=process.argv.slice(2)){
  return courseWorkspace(argumentValue(args,'--workspace')??engineRoot);
}
export function readCourse(root){return JSON.parse(fs.readFileSync(path.join(root,'setup/course-session.json'),'utf8'));}
export function readCourseRegistry(){
  const registry=JSON.parse(fs.readFileSync(path.join(engineRoot,'setup/courses.json'),'utf8'));
  return {...registry,courses:registry.courses.map(course=>({...course,root:courseWorkspace(course.workspace)}))};
}
