"use client";

/**
 * Gemini Live voice client.
 *
 * Mic audio is captured as mono Float32, resampled to 16 kHz PCM16, and sent to
 * the backend, which owns the Google API key. The server returns 24 kHz PCM16
 * chunks that are scheduled through Web Audio for gap-free playback. A short
 * local voice-activity check stops playback immediately on barge-in, before the
 * server round-trip completes.
 */

import { openVoiceSocket } from "./api";
import type { ChatMessage, ProposedAction } from "./types";

const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;
const WORKLET_NAME = "visun-pcm-capture";

const WORKLET_SOURCE = `
class VisunPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const channel = input[0];
    for (let index = 0; index < channel.length; index += 1) {
      this.buffer[this.offset] = channel[index];
      this.offset += 1;
      if (this.offset >= this.buffer.length) {
        const chunk = this.buffer;
        this.port.postMessage(chunk, [chunk.buffer]);
        this.buffer = new Float32Array(2048);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("${WORKLET_NAME}", VisunPcmCapture);
`;

export type LiveVoiceStatus =
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "reconnecting";

export type VoiceTurn = {
  conversationId: string;
  userText: string;
  assistantText: string;
  userMessage?: ChatMessage | null;
  assistantMessage?: ChatMessage | null;
};

export type VoiceClientHandlers = {
  onStatus?: (
    status: LiveVoiceStatus,
    detail?: { model?: string; voice?: string },
  ) => void;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onTurn?: (turn: VoiceTurn) => void;
  onTool?: (tool: unknown) => void;
  onApproval?: (action: ProposedAction) => void;
  onError?: (message: string) => void;
};

type ServerFrame = {
  type?: string;
  state?: string;
  mode?: string;
  role?: "user" | "assistant";
  text?: string;
  data?: string;
  model?: string;
  voice?: string;
  message?: string;
  conversationId?: string;
  userText?: string;
  assistantText?: string;
  userMessage?: ChatMessage | null;
  assistantMessage?: ChatMessage | null;
  tool?: unknown;
  action?: ProposedAction;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function resampleToPcm16(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Int16Array {
  if (!input.length || fromRate <= 0 || toRate <= 0) {
    return new Int16Array(0);
  }
  const length = Math.max(1, Math.floor((input.length * toRate) / fromRate));
  const output = new Int16Array(length);
  if (fromRate === toRate) {
    for (let index = 0; index < length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index]));
      output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  }
  if (fromRate > toRate) {
    // Average the source window so downsampling does not alias harshly.
    const ratio = fromRate / toRate;
    for (let index = 0; index < length; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.min(input.length, Math.floor((index + 1) * ratio));
      let total = 0;
      let count = 0;
      for (let source = start; source < end; source += 1) {
        total += input[source];
        count += 1;
      }
      const sample = count ? total / count : input[start] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return output;
  }
  const ratio = fromRate / toRate;
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    const sample =
      (input[left] ?? 0) * (1 - fraction) + (input[right] ?? 0) * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

function rootMeanSquare(input: Float32Array): number {
  let total = 0;
  for (let index = 0; index < input.length; index += 1) {
    total += input[index] * input[index];
  }
  return Math.sqrt(total / Math.max(1, input.length));
}

export class GeminiVoiceClient {
  private handlers: VoiceClientHandlers;
  private socket: WebSocket | null = null;
  private mode: "live" | "fallback" | null = null;
  private connectResolve: ((mode: "live" | "fallback") => void) | null = null;
  private connectTimer: number | null = null;
  private disposed = false;

  private inputContext: AudioContext | null = null;
  private inputRate = 48_000;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;

  private playbackContext: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private speaking = false;
  private bargeFrames = 0;

  private conversationId: string | null = null;
  private userText = "";
  private assistantText = "";

  constructor(handlers: VoiceClientHandlers = {}) {
    this.handlers = handlers;
  }

  /** Resolves to `live` when audio streaming is ready, or `fallback`. */
  async connect(conversationId: string | null): Promise<"live" | "fallback"> {
    this.disposed = false;
    this.mode = null;
    this.conversationId = conversationId;

    let socket: WebSocket;
    try {
      socket = await openVoiceSocket();
    } catch {
      return "fallback";
    }
    if (this.disposed) {
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      return "fallback";
    }

    this.socket = socket;
    socket.onmessage = (event) => this.handleMessage(String(event.data));
    socket.onclose = () => {
      if (this.disposed) return;
      if (this.mode === null) this.settle("fallback");
      this.handlers.onStatus?.("reconnecting");
      this.handlers.onError?.("Voice connection closed. Tap the mic to reconnect.");
    };
    socket.onerror = () => {
      if (this.mode === null) this.settle("fallback");
    };

    if (conversationId) {
      this.send({ type: "session", conversation_id: conversationId });
    }

    const mode = await new Promise<"live" | "fallback">((resolve) => {
      this.connectResolve = resolve;
      this.connectTimer = window.setTimeout(() => {
        this.settle("fallback");
      }, 5_500);
    });

    if (mode !== "live") {
      this.closeSocket();
      return mode;
    }

    try {
      await this.startMicrophone();
    } catch (error) {
      this.handlers.onError?.(
        error instanceof Error
          ? error.message
          : "The microphone could not be started.",
      );
      this.stop();
      return "fallback";
    }
    if (this.disposed) {
      // stop() ran while the microphone was starting; release it here.
      this.stopMicrophone();
      return "fallback";
    }
    this.mode = "live";
    return "live";
  }

  sendText(text: string): void {
    const clean = text.trim();
    if (clean) this.send({ type: "transcript", text: clean });
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.settle("fallback");
    this.stopPlayback();
    this.stopMicrophone();
    this.closeSocket();
    if (this.playbackContext) {
      void this.playbackContext.close();
      this.playbackContext = null;
    }
    this.mode = null;
    this.userText = "";
    this.assistantText = "";
    this.conversationId = null;
  }

  private settle(mode: "live" | "fallback"): void {
    if (this.mode !== null) return;
    this.mode = mode;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const resolve = this.connectResolve;
    this.connectResolve = null;
    resolve?.(mode);
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  }

  private handleMessage(raw: string): void {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      return;
    }

    switch (frame.type) {
      case "status": {
        if (frame.state === "ready" && frame.mode === "gemini_live") {
          this.settle("live");
          this.handlers.onStatus?.("ready", {
            model: frame.model,
            voice: frame.voice,
          });
          return;
        }
        if (frame.state === "fallback" || frame.mode === "transcript") {
          this.settle("fallback");
          this.closeSocket();
          return;
        }
        if (frame.state === "interrupted") {
          this.stopPlayback();
          this.assistantText = "";
          this.handlers.onTranscript?.("assistant", "");
          this.handlers.onStatus?.("interrupted");
          return;
        }
        if (
          frame.state === "listening" ||
          frame.state === "thinking" ||
          frame.state === "speaking" ||
          frame.state === "reconnecting"
        ) {
          this.handlers.onStatus?.(frame.state);
        }
        return;
      }
      case "transcript": {
        const role = frame.role === "assistant" ? "assistant" : "user";
        const text = frame.text ?? "";
        if (!text) return;
        if (role === "assistant") {
          this.assistantText += text;
          this.handlers.onTranscript?.("assistant", this.assistantText);
        } else {
          this.userText += text;
          this.handlers.onTranscript?.("user", this.userText);
        }
        return;
      }
      case "audio": {
        if (!frame.data) return;
        if (!this.speaking) this.handlers.onStatus?.("speaking");
        this.playAudio(frame.data);
        return;
      }
      case "turn": {
        const turn: VoiceTurn = {
          conversationId: frame.conversationId ?? this.conversationId ?? "",
          userText: frame.userText ?? "",
          assistantText: frame.assistantText ?? "",
          userMessage: frame.userMessage ?? null,
          assistantMessage: frame.assistantMessage ?? null,
        };
        this.userText = "";
        this.assistantText = "";
        if (turn.conversationId) this.conversationId = turn.conversationId;
        this.handlers.onTurn?.(turn);
        return;
      }
      case "tool": {
        this.handlers.onTool?.(frame.tool);
        return;
      }
      case "approval": {
        if (frame.action) this.handlers.onApproval?.(frame.action);
        return;
      }
      case "interrupted": {
        // The server confirmed the user spoke over the answer. Drop queued
        // audio immediately so the stale tail does not play over the new turn.
        this.stopPlayback();
        this.assistantText = "";
        this.handlers.onTranscript?.("assistant", "");
        this.handlers.onStatus?.("interrupted");
        return;
      }
      case "error": {
        this.handlers.onError?.(frame.message ?? "Voice session error.");
        return;
      }
      default:
        return;
    }
  }

  private async startMicrophone(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not expose microphone capture.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const context = new AudioContext();
    this.inputContext = context;
    this.inputRate = context.sampleRate;
    if (context.state === "suspended") await context.resume();
    const source = context.createMediaStreamSource(stream);
    // Worklets and ScriptProcessors only run while connected to a destination.
    // Route through a muted gain so the mic is never echoed to the speakers.
    const mute = context.createGain();
    mute.gain.value = 0;
    mute.connect(context.destination);
    this.mute = mute;

    if (typeof AudioWorkletNode !== "undefined" && context.audioWorklet) {
      const url = URL.createObjectURL(
        new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
      );
      try {
        await context.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const worklet = new AudioWorkletNode(context, WORKLET_NAME);
      this.worklet = worklet;
      worklet.port.onmessage = (event) => {
        this.onSamples(event.data as Float32Array);
      };
      source.connect(worklet);
      worklet.connect(mute);
      return;
    }

    // Safari and older Chromium builds without AudioWorklet still get voice.
    const processor = context.createScriptProcessor(2048, 1, 1);
    this.processor = processor;
    processor.onaudioprocess = (event) => {
      this.onSamples(event.inputBuffer.getChannelData(0));
    };
    source.connect(processor);
    processor.connect(mute);
  }

  private onSamples(samples: Float32Array): void {
    if (this.disposed || this.socket?.readyState !== WebSocket.OPEN) return;

    // Local barge-in: stop the queued reply as soon as the user starts talking,
    // without waiting for the server's VAD round-trip.
    if (this.speaking && rootMeanSquare(samples) > 0.035) {
      this.bargeFrames += 1;
      if (this.bargeFrames >= 2) {
        this.bargeFrames = 0;
        this.stopPlayback();
        this.send({ type: "interrupt" });
        this.handlers.onStatus?.("listening");
      }
    } else {
      this.bargeFrames = 0;
    }

    const pcm = resampleToPcm16(samples, this.inputRate, INPUT_RATE);
    if (!pcm.length) return;
    this.send({
      type: "audio",
      data: bytesToBase64(new Uint8Array(pcm.buffer)),
    });
  }

  private playAudio(encoded: string): void {
    const context = this.playbackContext ?? new AudioContext();
    this.playbackContext = context;
    if (context.state === "suspended") void context.resume();

    const bytes = base64ToBytes(encoded);
    const count = Math.floor(bytes.length / 2);
    if (!count) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 0x8000;
    }

    const buffer = context.createBuffer(1, count, OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const start = Math.max(context.currentTime + 0.03, this.nextStart);
    source.start(start);
    this.nextStart = start + buffer.duration;
    this.sources.add(source);
    this.speaking = true;

    source.onended = () => {
      this.sources.delete(source);
      if (!this.sources.size && this.speaking) {
        this.speaking = false;
        this.nextStart = 0;
        this.handlers.onStatus?.("listening");
      }
    };
  }

  private stopPlayback(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
    this.nextStart = 0;
    this.speaking = false;
    this.bargeFrames = 0;
  }

  private stopMicrophone(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
      this.worklet = null;
    }
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mute) {
      this.mute.disconnect();
      this.mute = null;
    }
    if (this.inputContext) {
      void this.inputContext.close();
      this.inputContext = null;
    }
  }
}
