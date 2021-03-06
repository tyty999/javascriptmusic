const SAMPLE_FRAMES = 128;

class AssemblyScriptMidiSynthAudioWorkletProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
    this.processorActive = true;
    this.playMidiSequence = true;
    AudioWorkletGlobalScope.midisequencer.currentFrame = 0;

    this.port.onmessage = async (msg) => {
        if(msg.data.wasm) {
          this.wasmInstancePromise = WebAssembly.instantiate(msg.data.wasm, {
            environment: { SAMPLERATE: msg.data.samplerate },
            env: {
              abort: () => console.log('webassembly synth abort, should not happen')
            }
          });
          this.wasmInstance = (await this.wasmInstancePromise).instance.exports;
          AudioWorkletGlobalScope.midisequencer.addMidiReceiver(this.wasmInstance.shortmessage);
        }
        
        if (msg.data.sequencedata) {
          AudioWorkletGlobalScope.midisequencer.setSequenceData(msg.data.sequencedata);
        }

        if (msg.data.toggleSongPlay !== undefined) {
          this.playMidiSequence = msg.data.toggleSongPlay;
          if (this.wasmInstance && msg.data.toggleSongPlay === false) {
            this.wasmInstance.allNotesOff();
          }
        }

        if (msg.data.midishortmsg) {
            (await this.wasmInstancePromise).instance.exports.shortmessage(
                msg.data.midishortmsg[0],
                msg.data.midishortmsg[1],
                msg.data.midishortmsg[2]
            );
            AudioWorkletGlobalScope.midisequencer.onmidi(msg.data.midishortmsg);
        }

        if (msg.data.recorded) {
          this.port.postMessage({ 'recorded':  AudioWorkletGlobalScope.midisequencer.getRecorded() });
        }
        
        if (msg.data.currentTime) {
          this.port.postMessage({ currentTime:  AudioWorkletGlobalScope.midisequencer.getCurrentTime()});
        }

        if (msg.data.terminate) {
          this.processorActive = false;
        }
    };
    this.port.start();
  }  

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    if (this.wasmInstance) {
      if (this.playMidiSequence) {
        AudioWorkletGlobalScope.midisequencer.onprocess();
      }
      this.wasmInstance.fillSampleBuffer();
      output[0].set(new Float32Array(this.wasmInstance.memory.buffer,
        this.wasmInstance.samplebuffer,
        SAMPLE_FRAMES));
      output[1].set(new Float32Array(this.wasmInstance.memory.buffer,
        this.wasmInstance.samplebuffer + (SAMPLE_FRAMES * 4),
        SAMPLE_FRAMES));
    }
  
    return this.processorActive;
  }
}

registerProcessor('asc-midisynth-audio-worklet-processor', AssemblyScriptMidiSynthAudioWorkletProcessor);
