/**
 * @gemma-gem/core - Core library for Gemma Gem AI agent
 * 
 * This library provides a reusable Node.js module for integrating
 * local Gemma model inference with tool execution capabilities.
 * 
 * @packageDocumentation
 */

export {
  GemmaModelHost,
  MODELS,
  DEFAULT_MODEL_ID,
  type ModelId,
  type ModelStatus,
  type StatusCallback,
  type ModelHostOptions,
} from './model'

export {
  GemmaAgent,
  createAgent,
  type AgentOptions,
  type RunCallbacks,
  type AgentRunResult,
} from './agent'

export {
  createTool,
  createFileSystemTools,
  createShellTools,
  combineTools,
  type Tool,
  type FileSystemTools,
  type ShellTools,
} from './tools'
