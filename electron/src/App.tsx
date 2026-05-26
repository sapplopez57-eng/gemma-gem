import { useState, useEffect, useRef } from 'react'
import { DesktopAgent } from './lib/desktop-agent'
import { desktopTools } from './lib/tools'
import { marked } from 'marked'

interface Message {
  role: 'user' | 'assistant' | 'thinking'
  content: string
  timestamp: Date
}

declare global {
  interface Window {
    electronAPI?: {
      readFile?: (path: string) => Promise<string>
      writeFile?: (path: string, content: string) => Promise<void>
      runCommand?: (command: string) => Promise<string>
      listDirectory?: (path: string) => Promise<string[]>
    }
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [currentResponse, setCurrentResponse] = useState('')
  
  const agentRef = useRef<DesktopAgent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    agentRef.current = new DesktopAgent(desktopTools)
    
    // Initialize model loading
    agentRef.current.loadModel().catch(err => {
      console.error('Failed to load model:', err)
      setModelStatus('error')
    })

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'model:status') {
        const { status, progress: prog, error } = event.data
        setModelStatus(status)
        if (prog !== undefined) setProgress(prog)
        if (error) console.error('Model error:', error)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  const handleSend = async () => {
    if (!inputValue.trim() || !agentRef.current || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setCurrentResponse('')

    try {
      await agentRef.current.run(userMessage.content, {
        onChunk: (text) => {
          setCurrentResponse(prev => prev + text)
        },
        onThinkingChunk: (text) => {
          setMessages(prev => {
            const lastThinking = prev[prev.length - 1]
            if (lastThinking && lastThinking.role === 'thinking') {
              const updated = { ...lastThinking, content: lastThinking.content + text }
              return [...prev.slice(0, -1), updated]
            } else {
              return [...prev, { role: 'thinking', content: text, timestamp: new Date() }]
            }
          })
        },
        onToolCall: (call) => {
          console.log('Tool call:', call.name, call.arguments)
        },
        onResponse: (response) => {
          setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }])
          setCurrentResponse('')
          setIsLoading(false)
        },
        onError: (error) => {
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date() }])
          setCurrentResponse('')
          setIsLoading(false)
        },
      })
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err instanceof Error ? err.message : String(err)}`, 
        timestamp: new Date() 
      }])
      setIsLoading(false)
    }
  }

  const handleStop = () => {
    agentRef.current?.stop()
    setIsLoading(false)
  }

  const handleClear = () => {
    agentRef.current?.clearHistory()
    setMessages([])
    setCurrentResponse('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Gemma Gem Desktop</h1>
        <div className="status">
          {modelStatus === 'loading' && (
            <span className="loading">
              Loading model... {progress}%
            </span>
          )}
          {modelStatus === 'ready' && (
            <span className="ready">● Ready</span>
          )}
          {modelStatus === 'error' && (
            <span className="error">● Error</span>
          )}
        </div>
        <button onClick={handleClear} disabled={messages.length === 0}>
          Clear Chat
        </button>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.role === 'thinking' ? (
                  <div className="thinking">
                    <strong>🤔 Thinking:</strong>
                    <p>{msg.content}</p>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: marked(msg.content) }} />
                )}
              </div>
              <div className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {currentResponse && (
            <div className="message assistant streaming">
              <div className="message-content">
                <div dangerouslySetInnerHTML={{ __html: marked(currentResponse) }} />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="input-area">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask Gemma anything..."
          disabled={modelStatus !== 'ready' || isLoading}
          rows={3}
        />
        <div className="input-buttons">
          {isLoading ? (
            <button onClick={handleStop} className="stop-button">
              Stop
            </button>
          ) : (
            <button onClick={handleSend} disabled={!inputValue.trim() || modelStatus !== 'ready'}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
