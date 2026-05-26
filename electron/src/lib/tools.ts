import { DesktopAgent, type DesktopTool } from './lib/desktop-agent'

// Define desktop tools (simplified versions without browser-specific APIs)
const desktopTools: DesktopTool[] = [
  {
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
    execute: async (args: Record<string, unknown>) => {
      const filePath = args.path as string
      try {
        // In Electron, this would use fs module via IPC
        const response = await window.electronAPI?.readFile?.(filePath)
        return { content: response || 'File reading not implemented' }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
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
    execute: async (args: Record<string, unknown>) => {
      const filePath = args.path as string
      const content = args.content as string
      try {
        await window.electronAPI?.writeFile?.(filePath, content)
        return { success: true, written: filePath }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
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
    execute: async (args: Record<string, unknown>) => {
      const command = args.command as string
      try {
        const result = await window.electronAPI?.runCommand?.(command)
        return { output: result || 'Command execution not implemented' }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
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
    execute: async (args: Record<string, unknown>) => {
      const dirPath = args.path as string
      try {
        const entries = await window.electronAPI?.listDirectory?.(dirPath)
        return { entries: entries || [] }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
]

export { desktopTools }
