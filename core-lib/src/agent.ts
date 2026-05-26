import { Agent as BaseAgent } from '@kessler/gemma-agent'
import type { ToolDefinition, ToolCall, Logger } from '@kessler/gemma-agent'
import type { ModelBackend } from '@kessler/gemma-agent'
import type { Tool } from './tools'

export interface AgentOptions {
  model: ModelBackend
  tools?: Tool[]
  systemPrompt?: string
  maxIterations?: number
  thinking?: boolean
  logger?: Logger
  onChunk?: (text: string) => void
  onThinkingChunk?: (text: string) => void
  onToolCall?: (call: ToolCall) => void
}

export interface RunCallbacks {
  onChunk?: (text: string) => void
  onThinkingChunk?: (text: string) => void
  onToolCall?: (call: ToolCall) => void
  onResponse?: (response: string) => void
  onError?: (error: Error) => void
}

export interface AgentRunResult {
  response: string
  toolCalls: ToolCall[]
}

/**
 * GemmaAgent - High-level agent for conversational AI with tool execution
 * 
 * This class wraps the base Agent from @kessler/gemma-agent and provides
 * a simplified interface for running conversations with tool support.
 * 
 * @example
 * ```typescript
 * import { GemmaAgent, GemmaModelHost } from '@gemma-gem/core'
 * import { createFileSystemTools, createShellTools } from '@gemma-gem/core/tools'
 * import fs from 'fs/promises'
 * import { exec } from 'child_process'
 * import { promisify } from 'util'
 * 
 * const execAsync = promisify(exec)
 * 
 * // Create model host
 * const modelHost = new GemmaModelHost({
 *   onStatus: (status, progress) => console.log(status, progress)
 * })
 * await modelHost.load('gemma-4-e2b-it')
 * 
 * // Create tools
 * const fsTools = createFileSystemTools({
 *   readFile: fs.readFile,
 *   writeFile: fs.writeFile,
 *   listDirectory: fs.readdir
 * })
 * 
 * const shellTools = createShellTools({
 *   runCommand: async (cmd) => {
 *     const { stdout, stderr } = await execAsync(cmd)
 *     return { stdout, stderr, exitCode: 0 }
 *   }
 * })
 * 
 * // Create agent
 * const agent = new GemmaAgent({
 *   model: modelHost,
 *   tools: [...Object.values(fsTools), ...Object.values(shellTools)],
 *   systemPrompt: 'You are a helpful coding assistant.'
 * })
 * 
 * // Run conversation
 * await agent.run('List files in current directory', {
 *   onChunk: (text) => process.stdout.write(text),
 *   onToolCall: (call) => console.log('Tool call:', call)
 * })
 * ```
 */
export class GemmaAgent {
  private agent: BaseAgent | null = null
  private model: ModelBackend
  private tools: Tool[]
  private systemPrompt: string
  private maxIterations: number
  private thinking: boolean
  private logger: Logger | undefined

  constructor(options: AgentOptions) {
    this.model = options.model
    this.tools = options.tools ?? []
    this.systemPrompt = options.systemPrompt ?? ''
    this.maxIterations = options.maxIterations ?? 10
    this.thinking = options.thinking ?? true
    this.logger = options.logger
  }

  /**
   * Run a conversation turn with the agent
   * @param userMessage - The user's message
   * @param callbacks - Optional callbacks for streaming responses
   */
  async run(userMessage: string, callbacks?: RunCallbacks): Promise<AgentRunResult> {
    if (!this.model.isLoaded()) {
      const error = new Error('Model not loaded')
      callbacks?.onError?.(error)
      throw error
    }

    const toolDefinitions: ToolDefinition[] = this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
    }))

    this.agent = new BaseAgent({
      model: this.model,
      tools: toolDefinitions,
      systemPrompt: this.systemPrompt,
      maxIterations: this.maxIterations,
      thinking: this.thinking,
      logger: this.logger,
      onChunk: callbacks?.onChunk,
      onThinkingChunk: callbacks?.onThinkingChunk,
      onToolCall: callbacks?.onToolCall,
    })

    try {
      const result = await this.agent.run(userMessage)
      callbacks?.onResponse?.(result.response)
      return {
        response: result.response,
        toolCalls: result.toolCalls || [],
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      callbacks?.onError?.(error)
      throw error
    }
  }

  /**
   * Stop ongoing generation
   */
  stop(): void {
    if (this.agent) {
      this.agent.abort()
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    if (this.agent) {
      this.agent.clearHistory()
    }
  }

  /**
   * Check if the model is loaded
   */
  isModelLoaded(): boolean {
    return this.model.isLoaded()
  }
}

/**
 * Convenience function to create and configure an agent
 */
export function createAgent(options: AgentOptions): GemmaAgent {
  return new GemmaAgent(options)
}
