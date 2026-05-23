import type { ToolDefinition, ToolCall } from '@kessler/gemma-agent'

/**
 * Base interface for tools that can be executed by the agent
 */
export interface Tool<TArgs = Record<string, unknown>, TResult = Record<string, unknown>> {
  name: string
  description: string
  parameters?: ToolDefinition['parameters']
  execute: (args: TArgs) => Promise<TResult>
}

/**
 * Create a tool definition with execution capability
 */
export function createTool<TArgs = Record<string, unknown>, TResult = Record<string, unknown>>(
  tool: Tool<TArgs, TResult>
): ToolDefinition & { execute: (args: TArgs) => Promise<TResult> } {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: tool.execute as (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  }
}

/**
 * File system tools for reading and writing files
 */
export interface FileSystemTools {
  readFile: Tool<{ path: string }, { content: string; error?: string }>
  writeFile: Tool<{ path: string; content: string }, { success: boolean; written?: string; error?: string }>
  listDirectory: Tool<{ path: string }, { entries: string[]; error?: string }>
}

/**
 * Create file system tools - requires implementation for specific environments
 * 
 * @example Node.js implementation:
 * ```typescript
 * import fs from 'fs/promises'
 * import path from 'path'
 * 
 * const tools = createFileSystemTools({
 *   readFile: async (filePath) => {
 *     try {
 *       const content = await fs.readFile(filePath, 'utf-8')
 *       return { content }
 *     } catch (e) {
 *       return { content: '', error: e.message }
 *     }
 *   },
 *   // ... implement other methods
 * })
 * ```
 */
export function createFileSystemTools(impl: {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  listDirectory: (path: string) => Promise<string[]>
}): FileSystemTools {
  return {
    readFile: createTool({
      name: 'read_file',
      description: 'Read the contents of a file from the local filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        try {
          const content = await impl.readFile(args.path)
          return { content }
        } catch (e) {
          return { content: '', error: e instanceof Error ? e.message : String(e) }
        }
      },
    }),
    writeFile: createTool({
      name: 'write_file',
      description: 'Write content to a file on the local filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
      execute: async (args: { path: string; content: string }) => {
        try {
          await impl.writeFile(args.path, args.content)
          return { success: true, written: args.path }
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : String(e) }
        }
      },
    }),
    listDirectory: createTool({
      name: 'list_directory',
      description: 'List files and directories in a given path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        try {
          const entries = await impl.listDirectory(args.path)
          return { entries }
        } catch (e) {
          return { entries: [], error: e instanceof Error ? e.message : String(e) }
        }
      },
    }),
  }
}

/**
 * Shell command execution tool
 */
export interface ShellTools {
  runCommand: Tool<{ command: string }, { output: string; exitCode?: number; error?: string }>
}

/**
 * Create shell command execution tool
 * 
 * @example Node.js implementation:
 * ```typescript
 * import { exec } from 'child_process'
 * import { promisify } from 'util'
 * const execAsync = promisify(exec)
 * 
 * const tools = createShellTools({
 *   runCommand: async (command) => {
 *     try {
 *       const { stdout, stderr } = await execAsync(command)
 *       return { output: stdout || stderr }
 *     } catch (e) {
 *       return { output: '', error: e.message }
 *     }
 *   }
 * })
 * ```
 */
export function createShellTools(impl: {
  runCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
}): ShellTools {
  return {
    runCommand: createTool({
      name: 'run_command',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute',
          },
        },
        required: ['command'],
      },
      execute: async (args: { command: string }) => {
        try {
          const result = await impl.runCommand(args.command)
          return { 
            output: result.stdout || result.stderr, 
            exitCode: result.exitCode 
          }
        } catch (e) {
          return { 
            output: '', 
            error: e instanceof Error ? e.message : String(e) 
          }
        }
      },
    }),
  }
}

/**
 * Combine multiple tool sets into a single array
 */
export function combineTools(...toolSets: Array<Record<string, Tool> | Tool[]>): Tool[] {
  const tools: Tool[] = []
  for (const toolSet of toolSets) {
    if (Array.isArray(toolSet)) {
      tools.push(...toolSet)
    } else {
      tools.push(...Object.values(toolSet))
    }
  }
  return tools
}
