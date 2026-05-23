import { Agent } from '@kessler/gemma-agent'
import type { ToolDefinition, ToolCall } from '@kessler/gemma-agent'
import { GemmaModelHost, DEFAULT_MODEL_ID, type ModelId } from './model-host'

export interface DesktopTool {
  name: string
  description: string
  parameters?: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

function getCountry(): string {
  const locale = navigator.language || 'en-US'
  const region = locale.split('-')[1]
  if (!region) return 'unknown'
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
    const country = displayNames.of(region)
    return country ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function buildSystemPrompt(): string {
  const now = new Date()
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const country = getCountry()

  return [
    `date: ${date}`,
    `time: ${time}`,
    `location: ${country}`,
    '',
    'You are Gemma Gem Desktop, a personal AI assistant running locally on the user\'s machine.',
    'You can help with coding tasks, answer questions, and assist with various activities.',
    'Be concise and helpful.',
  ].join('\n')
}

export class DesktopAgent {
  private agent: Agent | null = null
  private modelHost: GemmaModelHost
  private tools: DesktopTool[]

  constructor(tools: DesktopTool[]) {
    this.tools = tools
    this.modelHost = new GemmaModelHost((status, progress, error) => {
      window.postMessage({ type: 'model:status', status, progress, error }, '*')
    })
  }

  async loadModel(modelId: ModelId = DEFAULT_MODEL_ID): Promise<void> {
    await this.modelHost.load(modelId)
  }

  async run(userMessage: string, callbacks: {
    onChunk?: (text: string) => void
    onThinkingChunk?: (text: string) => void
    onToolCall?: (call: ToolCall) => void
    onResponse?: (response: string) => void
    onError?: (error: Error) => void
  }): Promise<void> {
    if (!this.modelHost.isLoaded()) {
      callbacks.onError?.(new Error('Model not loaded'))
      return
    }

    const toolDefinitions: ToolDefinition[] = this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    }))

    this.agent = new Agent({
      model: this.modelHost,
      tools: toolDefinitions,
      systemPrompt: buildSystemPrompt(),
      maxIterations: 10,
      thinking: true,
      logger: {
        info: (...args) => console.log('[Gemma Gem]', ...args),
        warn: (...args) => console.warn('[Gemma Gem]', ...args),
        error: (...args) => console.error('[Gemma Gem]', ...args),
        debug: (...args) => console.debug('[Gemma Gem]', ...args),
      },
      onChunk: callbacks.onChunk,
      onThinkingChunk: callbacks.onThinkingChunk,
      onToolCall: callbacks.onToolCall,
    })

    try {
      const result = await this.agent.run(userMessage)
      callbacks.onResponse?.(result.response)
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  stop(): void {
    this.modelHost.abort()
    if (this.agent) {
      this.agent.abort()
    }
  }

  clearHistory(): void {
    if (this.agent) {
      this.agent.clearHistory()
    }
  }

  isModelLoaded(): boolean {
    return this.modelHost.isLoaded()
  }

  getCurrentModelId(): ModelId | null {
    return this.modelHost.getCurrentModelId()
  }
}
