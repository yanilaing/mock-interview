export type SpeechRecognitionAudioPayload = {
  audioBase64: string;
  len: number;
  format: "pcm";
  sampleRate: 16000;
  channelCount: 1;
};

export type SpeechRecognitionTextPayload = {
  text: string;
  source: "browser";
};

export type SpeechRecognitionPayload =
  | SpeechRecognitionAudioPayload
  | SpeechRecognitionTextPayload;

export type SpeechCaptureSession = {
  stop: () => Promise<SpeechRecognitionPayload>;
  cancel: () => Promise<void>;
};

type BrowserSpeechRecognitionAlternative = {
  transcript?: string;
};

type BrowserSpeechRecognitionResult = {
  0?: BrowserSpeechRecognitionAlternative;
  isFinal?: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative | boolean | number | undefined;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
  SpeechRecognition?: BrowserSpeechRecognitionCtor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
};

const TARGET_SAMPLE_RATE = 16000;
const MIN_SAMPLE_THRESHOLD = 0.01;

const getAudioContextCtor = () => {
  const audioContextCtor =
    window.AudioContext || (window as WebkitWindow).webkitAudioContext;

  if (!audioContextCtor) {
    throw new Error("当前浏览器不支持音频采集");
  }

  return audioContextCtor;
};

const getSpeechRecognitionCtor = () => {
  const speechRecognitionCtor =
    (window as WebkitWindow).SpeechRecognition ||
    (window as WebkitWindow).webkitSpeechRecognition;

  return speechRecognitionCtor || null;
};

const mapSpeechRecognitionError = (error: string) => {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "浏览器未授予语音识别权限，请检查麦克风和语音识别权限设置";
    case "audio-capture":
      return "没有检测到可用麦克风，请检查设备或浏览器权限";
    case "network":
      return "浏览器内置语音识别网络异常，请重试或直接打字";
    case "no-speech":
      return "没有识别到有效语音，请靠近麦克风后重试";
    default:
      return "浏览器语音识别失败，请重试或直接打字";
  }
};

const mergeChunks = (chunks: Float32Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
};

const trimSilence = (buffer: Float32Array, threshold = MIN_SAMPLE_THRESHOLD) => {
  let start = 0;
  while (start < buffer.length && Math.abs(buffer[start] || 0) < threshold) {
    start += 1;
  }

  let end = buffer.length - 1;
  while (end > start && Math.abs(buffer[end] || 0) < threshold) {
    end -= 1;
  }

  return start >= end ? buffer : buffer.slice(start, end + 1);
};

const downsampleBuffer = (
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) => {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accumulated = 0;
    let count = 0;

    for (
      let index = offsetBuffer;
      index < nextOffsetBuffer && index < buffer.length;
      index += 1
    ) {
      accumulated += buffer[index] || 0;
      count += 1;
    }

    result[offsetResult] = count > 0 ? accumulated / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
};

const convertToInt16 = (buffer: Float32Array) => {
  const pcm = new Int16Array(buffer.length);

  for (let index = 0; index < buffer.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, buffer[index] || 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return pcm;
};

const pcmToBase64 = async (pcm: Int16Array) =>
  new Promise<string>((resolve, reject) => {
    const pcmArrayBuffer = pcm.buffer.slice(
      pcm.byteOffset,
      pcm.byteOffset + pcm.byteLength,
    ) as ArrayBuffer;
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.readAsDataURL(new Blob([pcmArrayBuffer], { type: "audio/pcm" }));
  });

const startBrowserSpeechCapture = async (): Promise<SpeechCaptureSession> => {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();
  if (!SpeechRecognitionCtor) {
    throw new Error("当前浏览器不支持内置语音识别");
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let ended = false;
  let cancelled = false;
  let finalTranscript = "";
  let interimTranscript = "";
  let errorMessage = "";
  let resolveStop: ((value: SpeechRecognitionTextPayload) => void) | null = null;
  let rejectStop: ((reason?: unknown) => void) | null = null;

  const finalizeStop = () => {
    if (!resolveStop || !rejectStop) {
      return;
    }

    const resolve = resolveStop;
    const reject = rejectStop;
    resolveStop = null;
    rejectStop = null;

    const transcript = `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim();

    if (transcript) {
      resolve({ text: transcript, source: "browser" });
      return;
    }

    reject(new Error(errorMessage || "没有识别到有效语音，请重试"));
  };

  recognition.onresult = (event) => {
    let nextInterimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const firstAlternative = result?.[0] as BrowserSpeechRecognitionAlternative | undefined;
      const transcript = firstAlternative?.transcript?.trim() || "";

      if (!transcript) {
        continue;
      }

      if (result?.isFinal) {
        finalTranscript = `${finalTranscript} ${transcript}`.replace(/\s+/g, " ").trim();
      } else {
        nextInterimTranscript = `${nextInterimTranscript} ${transcript}`.replace(/\s+/g, " ").trim();
      }
    }

    interimTranscript = nextInterimTranscript;
  };

  recognition.onerror = (event) => {
    if (cancelled && event.error === "aborted") {
      return;
    }

    errorMessage = mapSpeechRecognitionError(event.error);
  };

  recognition.onend = () => {
    ended = true;
    finalizeStop();
  };

  try {
    recognition.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : "浏览器语音识别启动失败";
    throw new Error(message);
  }

  return {
    stop: async () => {
      if (cancelled) {
        throw new Error("语音识别已取消");
      }

      return new Promise<SpeechRecognitionTextPayload>((resolve, reject) => {
        resolveStop = resolve;
        rejectStop = reject;

        if (ended) {
          finalizeStop();
          return;
        }

        try {
          recognition.stop();
        } catch {
          ended = true;
          finalizeStop();
        }
      });
    },
    cancel: async () => {
      if (cancelled) {
        return;
      }

      cancelled = true;
      resolveStop = null;
      rejectStop = null;

      try {
        if (recognition.abort) {
          recognition.abort();
        } else {
          recognition.stop();
        }
      } catch {
        // ignore cancellation errors
      }
    },
  };
};

const startAudioCapture = async (): Promise<SpeechCaptureSession> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextCtor = getAudioContextCtor();
  const audioContext = new AudioContextCtor();
  const inputSampleRate = audioContext.sampleRate;
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let closed = false;

  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(inputData));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  await audioContext.resume();

  const cleanup = async () => {
    if (closed) {
      return;
    }

    closed = true;
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
  };

  return {
    stop: async () => {
      await cleanup();

      const merged = mergeChunks(chunks);
      if (merged.length === 0) {
        throw new Error("录音时长太短，请再说一次");
      }

      const trimmed = trimSilence(merged);
      const resampled = downsampleBuffer(trimmed, inputSampleRate, TARGET_SAMPLE_RATE);
      const pcm = convertToInt16(resampled);

      if (pcm.length === 0) {
        throw new Error("没有采集到有效语音，请靠近麦克风后重试");
      }

      return {
        audioBase64: await pcmToBase64(pcm),
        len: pcm.length * 2,
        format: "pcm",
        sampleRate: TARGET_SAMPLE_RATE,
        channelCount: 1,
      };
    },
    cancel: cleanup,
  };
};

export const startSpeechCapture = async (): Promise<SpeechCaptureSession> => {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (SpeechRecognitionCtor) {
    try {
      return await startBrowserSpeechCapture();
    } catch (error) {
      console.warn("Browser speech recognition failed, fallback to server ASR", error);
    }
  }

  return startAudioCapture();
};
