const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {test}=require('node:test');
const {characterize}=require('./helpers/sts_preview_harness.cjs');
const {installGeneratedPreview}=require('./helpers/sts_preview_owner.cjs');
const baseline=require('./fixtures/sts-generated-preview.json');
const page=fs.readFileSync(`${__dirname}/../web/sts/index.html`,'utf8').replace(/\r\n/g,'\n');

test('preview owner preserves complete state and ordered effects from the checkpoint',async()=>{
  const {previousImageReceiptShape}=require('./helpers/sts_image_receipt_compat.cjs');
  assert.deepEqual(previousImageReceiptShape(await characterize(page,installGeneratedPreview)),baseline.cases);
});
test('frozen preview baseline independently reproduces from committed page',async()=>{
  const original=cp.execFileSync('git',['show',`${baseline.baseline}:web/sts/index.html`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  assert.deepEqual(await characterize(original),baseline.cases);
});
test('page has no mirrored preview fields or direct owner state assignments',()=>{
  for(const name of ['generatedImageUrl','generatedImageName','generatedImageStatusState','generatedImageStatusLabel','generatedImageRequestGeneration'])
    assert.doesNotMatch(page,new RegExp(`\\b(?:let|const|var) ${name}\\b`));
  assert.doesNotMatch(page,/generatedPreview\.(?:url|name|state|label|revision)\s*(?:=(?!=)|\+\+|\+=)/);
});
test('separate preview owners and stale completions cannot overwrite each other',()=>{
  const {create}=require('../web/sts/generated-preview.js');
  const a={captureCover:()=>null,resolveUrl:x=>x,show(){},changed(){},rollover(){},clear(){},begin(){},failed(){},retained(){}};
  const first=create(a),second=create(a),old=first.begin('one');
  second.show({url:'/two.png'});first.clear();first.fail(old.revision,Error('late'));first.retain(old.revision);
  assert.equal(first.state,'empty');assert.equal(second.url,'/two.png');assert.equal(second.state,'ready');
});
