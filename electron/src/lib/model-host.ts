import { Gemma4ForConditionalGeneration, AutoProcessor, TextStreamer, env } from '@huggingface/transformers'
import type { ModelBackend, GenerateOptions } from '@kessler/gemma-agent'

const SPECIAL_TOKENS = new Set([
  '<eos>', '<bos>', '<end_of_turn>', '<start_of_turn>',
  '<|turn>', '<turn|>',
  '<|tool>', '<tool|>',
  '<|tool_call>', '<tool_call|>',
  '<|tool_response>', '<tool_response|>',
  '<|channel>', '<channel|>',
  '<|think|>', '<|image|>',
  '<|\"|>',
])

function stripSpecialTokens(text: string): string {
  let result = text
  for (const token of SPECIAL_TOKENS) {
    if (result.includes(token)) {
      result = result.split(token).join('')
    }
  }
  return result
}

export const MODELS = {
  'gemma-4-e2b-it': {
    hfModelId: 'onnx-community/gemma-4-E2B-it-ONNX',
    contextLimit: 128_000,
  },
  'gemma-4-e4b-it': {
    hfModelId: 'onnx-community/gemma-4-E4B-it-ONNX',
    contextLimit: 128_000,
  },
}

export type ModelId = keyof typeof MODELS
export const DEFAULT_MODEL_ID: ModelId = 'gemma-4-e2b-it'

type StatusCallback = (status: 'loading' | 'ready' | 'error', progress?: number, error?: string) => void

export class GemmaModelHost implements ModelBackend {
  private model: InstanceType<typeof Gemma4ForConditionalGeneration> | null = null
  private processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null
  private loading = false
  private currentModelId: ModelId | null = null
  private loadingModelId: ModelId | null = null
  private onStatus: StatusCallback
  private abortController: AbortController | null = null
  contextLimit = 128_000

  constructor(onStatus: StatusCallback) {
    this.onStatus = onStatus
  }

  async load(modelId: ModelId = DEFAULT_MODEL_ID): Promise<void> {
    if (this.model && this.currentModelId === modelId) {
      this.onStatus('ready')
      return
    }
    if (this.model && this.currentModelId !== modelId) {
      await this.unload()
    }
    if (this.loading) {
      return
    }
    this.loading = true
    this.loadingModelId = modelId

    const config = MODELS[modelId]
    const fileProgress = new Map<string, number>()
    let lastReportedProgress = -1

    const progress_callback = (info: { status: string, file?: string, progress?: number }) => {
      if (info.status === 'progress' && info.file != null) {
        fileProgress.set(info.file, info.progress ?? 0)
        const values = [...fileProgress.values()]
        const overall = Math.round(values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1))
        if (overall !== lastReportedProgress) {
          lastReportedProgress = overall
          this.onStatus('loading', overall)
        }
      } else if (info.status === 'done' && info.file != null) {
        fileProgress.set(info.file, 100)
      } else if (info.status === 'ready') {
        this.onStatus('ready')
      }
    }

    try {
      const [model, processor] = await Promise.all([
        Gemma4ForConditionalGeneration.from_pretrained(config.hfModelId, {
          dtype: 'q4f16',
          device: 'webgpu',
          progress_callback,
        }),
        AutoProcessor.from_pretrained(config.hfModelId),
      ])

      this.model = model as InstanceType<typeof Gemma4ForConditionalGeneration>
      this.processor = processor
      this.currentModelId = modelId
      this.loadingModelId = null
      this.loading = false
      this.onStatus('ready')
    } catch (e) {
      this.loading = false
      this.loadingModelId = null
      this.onStatus('error', undefined, String(e))
      throw e
    }
  }

  async unload(): Promise<void> {
    if (this.model) {
      await this.model.dispose()
      this.model = null
    }
    this.processor = null
    this.currentModelId = null
    this.loading = false
  }

  getCurrentModelId(): ModelId | null {
    return this.currentModelId ?? this.loadingModelId
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async generateRaw(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!this.model || !this.processor) {
      throw new Error('Model not loaded')
    }

    let inputs: any
    if (options?.imageDataUrl) {
      const image = await env.load_image(options.imageDataUrl)
      inputs = await this.processor(prompt, image, null, { add_special_tokens: false })
    } else {
      inputs = this.processor.tokenizer(prompt, {
        add_special_tokens: false,
        return_tensor: 'pt',
      })
    }

    let rawResult = ''
    let insideThinking = false
    let insideToolCall = false
    let streamer: InstanceType<typeof TextStreamer>

    streamer = new TextStreamer(this.processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function: (text: string) => {
        rawResult += text

        if (text.includes('<|channel>')) {
          insideThinking = true
          return
        }
        if (text.includes('<channel|>')) {
          insideThinking = false
          return
        }
        if (insideThinking) {
          const clean = text.replace(/^thought\n?/, '')
          if (clean) options?.onThinkingChunk?.(clean)
          return
        }

        if (text.includes('<|tool_call>')) insideToolCall = true
        if (text.includes('<tool_call|>') || text.includes('<tool_response|>')) {
          insideToolCall = false
          return
        }
        if (insideToolCall || text.includes('<|tool_response>')) return

        const clean = stripSpecialTokens(text)
        if (clean) options?.onChunk?.(clean)
      },
    })

    this.abortController = new AbortController()
    try {
      await this.model.generate({
        ...inputs,
        max_new_tokens: options?.maxTokens ?? 1024,
        do_sample: false,
        streamer,
        abort_signal: this.abortController.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return rawResult
      }
      throw e
    } finally {
      this.abortController = null
    }

    return rawResult
  }

  countTokens(text: string): number {
    if (!this.processor) {
      throw new Error('Cannot count tokens: model not loaded')
    }
    const { input_ids } = this.processor.tokenizer(text, { add_special_tokens: false })
    return input_ids.size
  }

  isLoaded(): boolean {
    return this.model !== null
  }
}
