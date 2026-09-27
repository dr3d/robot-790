const fs=require('node:fs');
const vm=require('node:vm');
const {extract}=require('./sts_completion_harness.cjs');

function installImageRequest(c,page=fs.readFileSync(`${__dirname}/../../web/sts/index.html`,'utf8').replace(/\r\n/g,'\n')) {
  if(c.imageRequest || !page.includes('function createImageRequestOwner('))return;
  // Match browser Promise ownership when comparing concurrent effect ordering.
  vm.runInContext(fs.readFileSync(`${__dirname}/../../web/sts/image-request.js`,'utf8'),c);
  vm.runInContext(extract(page,'createImageRequestOwner'),c);
  c.imageRequest=c.createImageRequestOwner();
}
module.exports={installImageRequest};
