# @gemma-gem/core

Core library for Gemma Gem AI agent - a reusable Node.js module for integrating local Gemma model inference with tool execution capabilities.

## Installation

```bash
npm install @gemma-gem/core
# or
pnpm add @gemma-gem/core
# or
yarn add @gemma-gem/core
```

## Requirements

- Node.js >= 18.0.0
- WebGPU support (for GPU acceleration)
- Compatible with Electron, VS Code extensions, and other Node.js environments

## Quick Start

```typescript
import { GemmaAgent, GemmaModelHost } from '@gemma-gem/core'
import { createFileSystemTools, createShellTools } from '@gemma-gem/core/tools'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Create model host
const modelHost = new GemmaModelHost({
  onStatus: (status, progress) => console.log(`Model: ${status} ${progress}%`)
})

// Load the model (downloads on first run)
await modelHost.load('gemma-4-e2b-it')

// Create tools
const fsTools = createFileSystemTools({
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  listDirectory: fs.readdir
})

const shellTools = createShellTools({
  runCommand: async (cmd) => {
    const { stdout, stderr } = await execAsync(cmd)
    return { stdout, stderr, exitCode: 0 }
  }
})

// Create agent
const agent = new GemmaAgent({
  model: modelHost,
  tools: [...Object.values(fsTools), ...Object.values(shellTools)],
  systemPrompt: 'You are a helpful coding assistant running locally.'
})

// Run conversation
await agent.run('List files in current directory', {
  onChunk: (text) => process.stdout.write(text),
  onToolCall: (call) => console.log('Tool call:', call.name)
})
```

## API Reference

### GemmaModelHost

Handles loading and running Gemma models via ONNX Runtime.

```typescript
const host = new GemmaModelHost(options?: ModelHostOptions)

// Load a model
await host.load(modelId?: 'gemma-4-e2b-it' | 'gemma-4-e4b-it')

// Generate text
await host.generateRaw(prompt, options?: GenerateOptions)

// Check status
host.isLoaded()
host.getCurrentModelId()

// Abort generation
host.abort()

// Unload model
await host.unload()
```

### GemmaAgent

High-level agent for conversational AI with tool execution.

```typescript
const agent = new GemmaAgent({
  model: modelHost,
  tools: [/* array of tools */],
  systemPrompt: 'You are a helpful assistant.',
  maxIterations: 10,
  thinking: true
})

// Run conversation
await agent.run(userMessage, callbacks?: RunCallbacks)

// Stop generation
agent.stop()

// Clear history
agent.clearHistory()
```

### Tools

Create custom tools for the agent to use:

```typescript
import { createTool, createFileSystemTools, createShellTools, combineTools } from '@gemma-gem/core/tools'

// Built-in tool creators
const fsTools = createFileSystemTools({ readFile, writeFile, listDirectory })
const shellTools = createShellTools({ runCommand })

// Custom tool
const myTool = createTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' }
    },
    required: ['location']
  },
  execute: async ({ location }) => {
    // Fetch weather data
    return { temperature: 22, condition: 'sunny' }
  }
})

// Combine all tools
const allTools = combineTools(fsTools, shellTools, [myTool])
```

## Integration Examples

### VS Code Extension

```typescript
// In your extension's activation function
import { GemmaAgent, GemmaModelHost } from '@gemma-gem/core'
import { createFileSystemTools } from '@gemma-gem/core/tools'
import * as vscode from 'vscode'
import * as fs from 'fs/promises'

export async function activate(context: vscode.ExtensionContext) {
  const modelHost = new GemmaModelHost()
  await modelHost.load()
  
  const agent = new GemmaAgent({
    model: modelHost,
    tools: Object.values(createFileSystemTools({
      readFile: fs.readFile,
      writeFile: fs.writeFile,
      listDirectory: fs.readdir
    })),
    systemPrompt: 'You are a VS Code coding assistant.'
  })
  
  // Register commands that use the agent
  context.subscriptions.push(
    vscode.commands.registerCommand('gemma-gem.explain', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return
      
      const code = editor.document.getText(editor.selection)
      await agent.run(`Explain this code: ${code}`)
    })
  )
}
```

### Electron App

```typescript
// In Electron main process
import { app, ipcMain } from 'electron'
import { GemmaAgent, GemmaModelHost } from '@gemma-gem/core'
import { createFileSystemTools, createShellTools } from '@gemma-gem/core/tools'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

let agent: GemmaAgent

app.whenReady().async () => {
  const modelHost = new GemmaModelHost()
  await modelHost.load()
  
  agent = new GemmaAgent({
    model: modelHost,
    tools: [
      ...Object.values(createFileSystemTools({
        readFile: fs.readFile,
        writeFile: fs.writeFile,
        listDirectory: fs.readdir
      })),
      ...Object.values(createShellTools({
        runCommand: promisify(exec)
      }))
    ]
  })
  
  ipcMain.handle('agent:run', async (event, message) => {
    let response = ''
    await agent.run(message, {
      onChunk: (text) => {
        event.sender.send('agent:chunk', text)
        response += text
      }
    })
    return response
  })
})
```

## Models

| Model ID | Size | Context Limit | Use Case |
|----------|------|---------------|----------|
| `gemma-4-e2b-it` | ~500MB | 128K | General purpose, faster |
| `gemma-4-e4b-it` | ~1.5GB | 128K | More capable, better reasoning |

## License

Apache-2.0
