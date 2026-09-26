"""Replay captured cutoff batches with real TTS; run with voice worker stopped."""

import json
import logging
import re
import wave
from pathlib import Path
from queue import Queue
from threading import Event

from robot_790d.local_model_startup import configure_local_model_startup

configure_local_model_startup()

import numpy as np
from speech_to_speech.TTS.qwen3_tts_handler import Qwen3TTSHandler
from speech_to_speech.pipeline.cancel_scope import CancelScope
from robot_790d.tts_capacity import install_tts_capacity_patch

root = Path(__file__).resolve().parents[2]
out = root / 'logs/maintenance/tts-capacity-replay'
out.mkdir(parents=True, exist_ok=True)
logging.basicConfig(level=logging.INFO, handlers=[logging.FileHandler(out / 'probe.log', encoding='utf-8')])
original_voice = Qwen3TTSHandler._process_custom_voice
install_tts_capacity_patch()
handler = Qwen3TTSHandler(Event(), Queue(), Queue(), setup_kwargs={
    'should_listen': Event(), 'device': 'cuda', 'dtype': 'bfloat16', 'backend': 'torch',
    'model_name': r'C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice',
    'speaker': 'Eric', 'language': 'English', 'max_new_tokens': 4096,
    'cancel_scope': CancelScope(),
})
raw = (root / 'logs/runs/20260925-2108-exploration-speech-cutoffs/evidence/logs/sts-realtime.out.log').read_text(encoding='utf-8')
parts = re.split(r'(?m)^ASSISTANT: ', raw)
cases = []
for prefix in ['I built a mood', 'It breaks long-held assumptions']:
    match = next(part for part in parts if part.startswith(prefix))
    text = re.split(r'(?m)^Live:|^USER:|^INFO:', match)[0].strip()
    cases.append(re.sub(r'\s+', ' ', text))
results = []
for name, text, synth in [('baseline', cases[0], original_voice),
                          ('repaired-first', cases[0], Qwen3TTSHandler._process_custom_voice),
                          ('repaired-second', cases[1], Qwen3TTSHandler._process_custom_voice)]:
    print(f'Synthesizing {name}: {len(text)} characters', flush=True)
    audio = np.concatenate(list(synth(handler, text)))
    with wave.open(str(out / f'{name}.wav'), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(audio.tobytes())
    results.append({'name': name, 'characters': len(text), 'seconds': len(audio) / 16000,
                    'expected_end': text[-180:]})
    print(json.dumps(results[-1]), flush=True)

from nano_parakeet import from_pretrained
recognizer = from_pretrained(model_name='nvidia/parakeet-tdt-0.6b-v3', device='cuda')
for result in results:
    with wave.open(str(out / (result['name'] + '.wav')), 'rb') as wav:
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    result['heard_tail'] = recognizer.transcribe(audio[-30 * 16000:]).strip()
    print(json.dumps(result), flush=True)
(out / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
assert 'helps him read the set' in results[1]['heard_tail'].lower(), results[1]
assert 'whenever' in results[2]['heard_tail'].lower(), results[2]
print('Both repaired passages reach their original endings.', flush=True)
