// Apply the existing environment proxy to Node fetch (including Pi OAuth).
// NO_PROXY keeps local callback requests on loopback.
const path=require('node:path');
const {createRequire}=require('node:module');
if(process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy){
  const runtime=process.env.LEARN_PI_RUNTIME_DIR;
  if(!runtime)throw new Error('Missing LEARN_PI_RUNTIME_DIR for proxy setup');
  const {EnvHttpProxyAgent,setGlobalDispatcher}=createRequire(path.join(runtime,'package.json'))('undici');
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
