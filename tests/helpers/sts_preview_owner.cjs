const fs = require('node:fs');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function installGeneratedPreview(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  require('./sts_eye_content_owner.cjs').installEyeContent(c, page);
  if (c.generatedPreview || !page.includes('function createGeneratedPreviewOwner(')) return;
  const names = {generatedImageUrl:'url',generatedImageName:'name',generatedImageStatusState:'state',
    generatedImageStatusLabel:'label',generatedImageRequestGeneration:'revision'};
  const initial = Object.fromEntries(Object.keys(names).map(n=>[n,c[n]]));
  c.Robot790GeneratedPreview = require('../../web/sts/generated-preview.js');
  vm.runInContext(extract(page,'createGeneratedPreviewOwner'),c);
  c.generatedPreview = c.createGeneratedPreviewOwner();
  // Legacy fixture inputs alias the production owner, never duplicate its state.
  for(const [name,field] of Object.entries(names)) {
    if(initial[name]!==undefined)c.generatedPreview[field]=initial[name];
    Object.defineProperty(c,name,{configurable:true,enumerable:true,
      get:()=>c.generatedPreview[field],set:value=>{c.generatedPreview[field]=value;}});
  }
}
module.exports={installGeneratedPreview};
