import { NextRequest, NextResponse } from 'next/server';
import {
  buildSpeechRecognitionSystemPrompt,
  correctASRText,
} from './correction';

export const runtime = 'nodejs';

type SpeechRecognitionRequest = {
  audioBase64?: string;
  len?: number;
  format?: 'pcm' | 'wav';
  sampleRate?: number;
  channelCount?: number;
  context?: string;
  positionSlug?: string;
};

type DashScopeAsrResponse = {
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
};

const createWaveHeader = (
  pcmByteLength: number,
  sampleRate: number,
  channelCount: number,
) => {
  const bitsPerSample = 16;
  const blockAlign = channelCount * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmByteLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmByteLength, 40);

  return buffer;
};

const buildAudioDataUrl = (
  audioBase64: string,
  format: 'pcm' | 'wav',
  sampleRate: number,
  channelCount: number,
) => {
  const normalizedBase64 = audioBase64.replace(/\s+/g, '');

  if (format === 'wav') {
    return `data:audio/wav;base64,${normalizedBase64}`;
  }

  const pcmBuffer = Buffer.from(normalizedBase64, 'base64');
  const wavBuffer = Buffer.concat([
    createWaveHeader(pcmBuffer.length, sampleRate, channelCount),
    pcmBuffer,
  ]);

  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
};

const readTextFromAsrResponse = (data: DashScopeAsrResponse) =>
  data.output?.choices?.[0]?.message?.content
    ?.map((item) => item.text?.trim())
    .find(Boolean) || '';

async function recognizeSpeech(
  audioDataUrl: string,
  positionSlug: string,
  context: string,
) {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error('缺少 DASHSCOPE_API_KEY 配置');
  }

  const response = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen3-asr-flash',
        input: {
          messages: [
            {
              role: 'system',
              content: [{ text: buildSpeechRecognitionSystemPrompt(positionSlug, context) }],
            },
            {
              role: 'user',
              content: [{ audio: audioDataUrl }],
            },
          ],
        },
        parameters: {
          asr_options: {
            enable_itn: true,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || /InvalidApiKey/i.test(errorText)) {
      throw new Error(
        'DASHSCOPE_API_KEY 无效或已过期，云端语音识别当前不可用。请更新 .env.local 后重启开发服务器。'
      );
    }

    throw new Error(`阿里云语音识别请求失败 (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as DashScopeAsrResponse;
  const text = readTextFromAsrResponse(data);

  if (!text) {
    throw new Error(data.message || data.code || '阿里云语音识别未返回文本');
  }

  return text;
}

export async function POST(req: NextRequest) {
  try {
    const {
      audioBase64,
      len,
      format = 'pcm',
      sampleRate = 16000,
      channelCount = 1,
      context = '',
      positionSlug = 'java-backend',
    } = (await req.json()) as SpeechRecognitionRequest;

    if (!audioBase64 || !len) {
      return NextResponse.json({ error: '缺少音频数据' }, { status: 400 });
    }

    const audioDataUrl = buildAudioDataUrl(
      audioBase64,
      format,
      sampleRate,
      channelCount,
    );
    const rawText = (await recognizeSpeech(audioDataUrl, positionSlug, context)).trim();
    const correctedText = rawText
      ? await correctASRText(rawText, context, positionSlug)
      : rawText;

    return NextResponse.json({
      text: correctedText,
      raw: rawText,
    });
  } catch (error: unknown) {
    console.error('阿里云语音识别错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '识别失败' },
      { status: 500 },
    );
  }
}
