let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

if (typeof window !== 'undefined' && window.leadgenSoundEnabled === undefined) {
  window.leadgenSoundEnabled = true
}

function playTone(freqStart, freqEnd, duration, volume) {
  if (!window.leadgenSoundEnabled) return
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freqStart, ac.currentTime)
    osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + duration / 1000)
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration / 1000)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + duration / 1000)
  } catch (_) {
    // ignore
  }
}

export function playClick()   { playTone(600,  400,  80,  0.08) }
export function playSuccess() { playTone(800,  1200, 200, 0.1)  }
export function playError()   { playTone(300,  200,  150, 0.08) }

export function toggleSound() {
  window.leadgenSoundEnabled = !window.leadgenSoundEnabled
  return window.leadgenSoundEnabled
}

export function isSoundEnabled() {
  return window.leadgenSoundEnabled !== false
}
