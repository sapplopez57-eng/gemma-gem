# Gemma Gem Desktop

Aplicación de escritorio para uso local del agente AI Gemma, refactorizada desde la extensión de navegador original.

**Nota:** Esta aplicación ahora utiliza la librería `@gemma-gem/core` como dependencia principal.

## Requisitos

- Node.js 18+
- GPU con soporte WebGPU (para inferencia del modelo)
- ~500MB-1.5GB de espacio para el modelo Gemma 4

## Instalación

```bash
cd electron
pnpm install
```

## Desarrollo

```bash
pnpm electron:dev
```

Esto iniciará Vite en modo desarrollo y Electron automáticamente cuando el servidor esté listo.

## Build de Producción

```bash
pnpm electron:build
```

## Arquitectura

La aplicación desktop utiliza la librería `@gemma-gem/core` para el núcleo del agente:

```
┌─────────────────────────────────────────┐
│           Renderer Process              │
│  ┌─────────────┐  ┌──────────────────┐ │
│  │   React UI  │  │  @gemma-gem/core │ │
│  │             │  │  - GemmaAgent    │ │
│  │             │  │  - GemmaModelHost│ │
│  └─────────────┘  └──────────────────┘ │
│         │                  │            │
│         └────────┬─────────┘            │
└──────────────────┼──────────────────────┘
                   │ IPC
┌──────────────────┼──────────────────────┐
│           Main Process                 │
│  ┌─────────────▼─────────────────────┐ │
│  │     File System / Shell APIs      │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Uso de @gemma-gem/core

```typescript
import { GemmaAgent, GemmaModelHost } from '@gemma-gem/core'
import { createFileSystemTools, createShellTools } from '@gemma-gem/core/tools'

// Crear host del modelo
const modelHost = new GemmaModelHost({
  onStatus: (status, progress) => console.log(status, progress)
})

// Cargar modelo
await modelHost.load('gemma-4-e2b-it')

// Crear herramientas
const fsTools = createFileSystemTools({
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  listDirectory: fs.readdir
})

const shellTools = createShellTools({
  runCommand: execAsync
})

// Crear agente
const agent = new GemmaAgent({
  model: modelHost,
  tools: [...Object.values(fsTools), ...Object.values(shellTools)],
  systemPrompt: 'Eres un asistente de programación útil.'
})

// Ejecutar conversación
await agent.run('Lista los archivos en el directorio actual', {
  onChunk: (text) => console.log(text),
  onToolCall: (call) => console.log('Tool:', call.name)
})
```

## Componentes

### Interfaz (`src/`)

- **`App.tsx`**: Componente principal de chat con streaming de respuestas
- **`index.css`**: Estilos modernos oscuros

### Electron (`electron/`)

- **`main.js`**: Proceso principal con handlers IPC para operaciones del sistema
- **`preload.js`**: Puente seguro entre renderer y main process

## Diferencias con la Extensión

| Extensión | Desktop |
|-----------|---------|
| Herramientas DOM (click, type, scroll) | Herramientas de filesystem |
| Ejecución en contexto de página | Ejecución de comandos shell |
| Limitado al navegador | Acceso completo al sistema |
| WebGPU en offscreen document | WebGPU en renderer process |

## Modelo

La aplicación descarga automáticamente Gemma 4 E2B (~500MB) o E4B (~1.5GB) desde HuggingFace en la primera ejecución. Los modelos se cachean localmente.

## Seguridad

⚠️ **Advertencia**: Las herramientas de ejecución de comandos y acceso al filesystem deben usarse con precaución. En un entorno de producción, considere:

- Sandbox de comandos permitidos
- Confirmación del usuario antes de ejecutar acciones
- Restricción de directorios accesibles

## Licencia

Apache-2.0 (mismo que el proyecto original)
