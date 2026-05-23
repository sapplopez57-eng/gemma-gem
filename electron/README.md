# Gemma Gem Desktop

Aplicación de escritorio para uso local del agente AI Gemma, refactorizada desde la extensión de navegador original.

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

La aplicación desktop mantiene el núcleo del agente original pero adaptado para Electron:

```
┌─────────────────────────────────────────┐
│           Renderer Process              │
│  ┌─────────────┐  ┌──────────────────┐ │
│  │   React UI  │  │  DesktopAgent    │ │
│  │             │  │  + GemmaModelHost│ │
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

## Componentes Refactorizados

### Núcleo del Agente (`src/lib/`)

- **`model-host.ts`**: Adaptación del host del modelo para entorno desktop, usando WebGPU directamente en el renderer process
- **`desktop-agent.ts`**: Orquestador del agente que integra el modelo con herramientas de escritorio
- **`tools.ts`**: Herramientas específicas para desktop (lectura/escritura de archivos, ejecución de comandos, etc.)

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
