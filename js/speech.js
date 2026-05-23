let _koVoice = null;
let _ready = false;

function _initVoice() {
  const voices = window.speechSynthesis.getVoices();
  _koVoice = voices.find(v => v.lang.startsWith('ko')) || voices[0] || null;
  _ready = true;
}

if ('speechSynthesis' in window) {
  if (window.speechSynthesis.getVoices().length > 0) {
    _initVoice();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', _initVoice, { once: true });
  }
}

export function speak(text, options = {}) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = 'ko-KR';
  utter.rate  = options.rate  ?? 0.92;
  utter.pitch = options.pitch ?? 1.0;
  if (_koVoice) utter.voice = _koVoice;

  window.speechSynthesis.speak(utter);
}
