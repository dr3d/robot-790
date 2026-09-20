const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadFunctions } = require('./sts_tool_harness.cjs');

function fixture(c = vm.createContext({})) {
  const requests = [], staged = [];
  const element = () => ({ classList: { add() {}, remove() {} }, removeAttribute() {} });
  Object.assign(c, {
    URL, location: { href: 'http://127.0.0.1:8790/' }, events: {}, log() {},
    generatedImageStatusState: 'empty', generatedImageStatusLabel: '', generatedImageRequestGeneration: 0,
    generatedImageUrl: '', generatedImageName: '', generatedImageHint: {},
    generatedImageCard: element(), generatedImagePreview: element(), updateGeneratedImageButtons() {},
    currentImageModel: () => 'test', currentImageQuality: () => 'low', imageSettingLabel: () => 'test',
    audioRecordingActive: () => false, rolloverAudioRecordingForVisualChange() {},
    sensingEyeGeneration: 1, visionImageUrl: '/operator.jpg', sensingTextContent: '', visionImageStaged: false,
    blobToDataUrl: async () => 'data:image/png;base64,test', loadImage: async () => ({}),
    filenameFromPath: value => value.split('/').at(-1),
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, blob: async () => ({}), json: async () => ({
        status: 'ok', filename: 'retained.png', url: '/generated-images/retained.png',
      }) };
    },
    setVisionImageFromDrawable: async (_image, name, options) => {
      assert.equal(options.isCurrent(), true);
      assert.equal(options.eyeGeneration, c.sensingEyeGeneration);
      staged.push({ name, options });
      c.visionImageUrl = '/eye.jpg'; c.visionImageName = name; c.visionImageStaged = true;
      return { savedFilename: 'eye.jpg', openUrl: '/sensing-eye/eye.jpg' };
    },
  });
  loadFunctions(c, ['generateImage', 'showGeneratedImage', 'clearGeneratedImage', 'moveGeneratedImageToSensingEye']);
  return { c, requests, staged };
}

module.exports = { fixture };
