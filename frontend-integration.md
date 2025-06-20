---
sidebar_position: 4
---

# Frontend Integration

Learn how to integrate INTU Web-Kit with AI chat capabilities to create intelligent Web3 user interfaces. This guide covers building conversational interfaces that can execute blockchain transactions through natural language.

## Overview

The frontend integration combines:
- **INTU Web-Kit**: Secure wallet management and transaction execution
- **AI Chat Interface**: Natural language interaction with AI models
- **Real-time Communication**: Streaming responses and live updates
- **Blockchain Integration**: Execute transactions directly from chat

## Architecture

```
┌─────────────────────────────────────┐
│           React Frontend            │
│  ┌─────────────┐ ┌─────────────────┐ │
│  │ INTU Web-Kit│ │  AI Chat UI     │ │
│  │ • Wallet    │ │  • Streaming    │ │
│  │ • Vaults    │ │  • Personas     │ │
│  │ • Txns      │ │  • Commands     │ │
│  └─────────────┘ └─────────────────┘ │
└─────────────────┬───────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────┐
│         AI Orchestrator             │
│  • Session Management              │
│  • INTU Integration                │
│  • Transaction Coordination        │
└─────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install @intuweb3/web-kit ethers
npm install @intuweb3/ai-chat  # AI chat components
```

### 2. Basic Setup

```javascript
// App.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from "ethers";
import { getVaults, createIntuAccount } from '@intuweb3/web-kit';
import { AIChatInterface } from '@intuweb3/ai-chat';

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userVaults, setUserVaults] = useState([]);

  useEffect(() => {
    initializeINTU();
  }, []);

  const initializeINTU = async () => {
    // Connect to wallet
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Get user's INTU vaults
    const vaults = await getVaults(address, provider);

    setProvider(provider);
    setSigner(signer);
    setUserAddress(address);
    setUserVaults(vaults);
  };

  return (
    <div className="app">
      <header>
        <h1>AI-Powered Web3 App</h1>
        <p>Connected: {userAddress}</p>
        <p>Vaults: {userVaults.length}</p>
      </header>
      
      <AIChatInterface
        userAddress={userAddress}
        userVaults={userVaults}
        provider={provider}
        signer={signer}
        orchestratorUrl="http://localhost:3005"
      />
    </div>
  );
}

export default App;
```

## AI Chat Interface

### Basic Chat Component

```javascript
// components/AIChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createIntuAccount } from '@intuweb3/web-kit';

const AIChatInterface = ({ 
  userAddress, 
  userVaults, 
  provider, 
  signer,
  orchestratorUrl 
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPersona, setCurrentPersona] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send message to AI orchestrator
      const response = await fetch(`${orchestratorUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: userAddress,
          message: inputMessage,
          context: {
            userAddress,
            vaults: userVaults.map(v => v.address),
            persona: currentPersona
          }
        })
      });

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions // Potential blockchain actions
      };

      setMessages(prev => [...prev, aiMessage]);

      // Handle any blockchain actions suggested by AI
      if (data.actions && data.actions.length > 0) {
        await handleAIActions(data.actions);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIActions = async (actions) => {
    for (const action of actions) {
      if (action.type === 'create_vault') {
        await handleCreateVault(action.params);
      } else if (action.type === 'execute_transaction') {
        await handleExecuteTransaction(action.params);
      } else if (action.type === 'generate_persona') {
        await handleGeneratePersona(action.params);
      }
    }
  };

  const handleCreateVault = async (params) => {
    try {
      const newVault = await createIntuAccount(
        params.participants,
        params.name,
        params.rotateThreshold,
        params.txThreshold,
        params.adminThreshold,
        signer
      );

      const confirmationMessage = {
        id: Date.now(),
        type: 'system',
        content: `✅ Created new INTU vault: ${params.name}`,
        timestamp: new Date(),
        data: { vaultAddress: newVault.address }
      };

      setMessages(prev => [...prev, confirmationMessage]);
    } catch (error) {
      console.error('Error creating vault:', error);
    }
  };

  const handleExecuteTransaction = async (params) => {
    // Show transaction preview
    const previewMessage = {
      id: Date.now(),
      type: 'transaction-preview',
      content: 'Transaction Preview',
      timestamp: new Date(),
      data: params
    };

    setMessages(prev => [...prev, previewMessage]);
  };

  const handleGeneratePersona = async (params) => {
    try {
      const response = await fetch(`${orchestratorUrl}/generate-persona`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evmAddress: params.evmAddress || userAddress,
          traits: params.traits
        })
      });

      const persona = await response.json();
      setCurrentPersona(persona);

      const personaMessage = {
        id: Date.now(),
        type: 'persona',
        content: `🎭 Generated new persona: ${persona.name}`,
        timestamp: new Date(),
        data: persona
      };

      setMessages(prev => [...prev, personaMessage]);
    } catch (error) {
      console.error('Error generating persona:', error);
    }
  };

  return (
    <div className="ai-chat-interface">
      <div className="chat-header">
        <h2>AI Assistant</h2>
        {currentPersona && (
          <div className="current-persona">
            <img src={currentPersona.imageUrl} alt={currentPersona.name} />
            <span>{currentPersona.name}</span>
          </div>
        )}
      </div>

      <div className="messages-container">
        {messages.map(message => (
          <MessageComponent key={message.id} message={message} />
        ))}
        {isLoading && <LoadingMessage />}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask me anything about Web3..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
          Send
        </button>
      </div>
    </div>
  );
};

export default AIChatInterface;
```

### Message Components

```javascript
// components/MessageComponent.jsx
import React from 'react';
import TransactionPreview from './TransactionPreview';
import PersonaCard from './PersonaCard';

const MessageComponent = ({ message }) => {
  const renderContent = () => {
    switch (message.type) {
      case 'user':
        return (
          <div className="message user-message">
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="message ai-message">
            <div className="ai-avatar">🤖</div>
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="message system-message">
            <div className="message-content">{message.content}</div>
          </div>
        );

      case 'transaction-preview':
        return (
          <TransactionPreview 
            transaction={message.data}
            onApprove={() => console.log('Transaction approved')}
            onReject={() => console.log('Transaction rejected')}
          />
        );

      case 'persona':
        return (
          <PersonaCard persona={message.data} />
        );

      case 'error':
        return (
          <div className="message error-message">
            <div className="message-content">❌ {message.content}</div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
};

export default MessageComponent;
```

### Transaction Preview Component

```javascript
// components/TransactionPreview.jsx
import React from 'react';
import { ethers } from 'ethers';

const TransactionPreview = ({ transaction, onApprove, onReject }) => {
  const formatValue = (value) => {
    if (value === '0') return '0 ETH';
    return `${ethers.utils.formatEther(value)} ETH`;
  };

  return (
    <div className="transaction-preview">
      <div className="preview-header">
        <h3>🔄 Transaction Preview</h3>
        <span className="preview-status">Pending Approval</span>
      </div>
      
      <div className="preview-details">
        <div className="detail-row">
          <span className="label">To:</span>
          <span className="value">{transaction.to}</span>
        </div>
        <div className="detail-row">
          <span className="label">Value:</span>
          <span className="value">{formatValue(transaction.value)}</span>
        </div>
        <div className="detail-row">
          <span className="label">Gas Limit:</span>
          <span className="value">{transaction.gasLimit}</span>
        </div>
        {transaction.data && transaction.data !== '0x' && (
          <div className="detail-row">
            <span className="label">Data:</span>
            <span className="value code">{transaction.data}</span>
          </div>
        )}
      </div>

      <div className="preview-actions">
        <button 
          className="approve-button"
          onClick={onApprove}
        >
          ✅ Approve
        </button>
        <button 
          className="reject-button"
          onClick={onReject}
        >
          ❌ Reject
        </button>
      </div>
    </div>
  );
};

export default TransactionPreview;
```

## Advanced Features

### Streaming Responses

```javascript
// hooks/useStreamingChat.js
import { useState, useEffect } from 'react';

export const useStreamingChat = (orchestratorUrl, userAddress) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const sendStreamingMessage = async (message) => {
    const eventSource = new EventSource(
      `${orchestratorUrl}/message/stream?sessionId=${userAddress}&message=${encodeURIComponent(message)}`
    );

    const streamingMessage = {
      id: Date.now(),
      type: 'ai',
      content: '',
      timestamp: new Date(),
      streaming: true
    };

    setMessages(prev => [...prev, streamingMessage]);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.content) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === streamingMessage.id 
              ? { ...msg, content: msg.content + data.content }
              : msg
          )
        );
      }

      if (data.done) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === streamingMessage.id 
              ? { ...msg, streaming: false }
              : msg
          )
        );
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  return { messages, sendStreamingMessage, isConnected };
};
```

### Persona Management

```javascript
// components/PersonaManager.jsx
import React, { useState, useEffect } from 'react';

const PersonaManager = ({ userAddress, orchestratorUrl }) => {
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, [userAddress]);

  const loadPersonas = async () => {
    try {
      const response = await fetch(`${orchestratorUrl}/personas/${userAddress}`);
      const data = await response.json();
      setPersonas(data.personas || []);
    } catch (error) {
      console.error('Error loading personas:', error);
    }
  };

  const generatePersona = async (traits = {}) => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${orchestratorUrl}/generate-persona`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evmAddress: userAddress,
          traits
        })
      });

      const newPersona = await response.json();
      setPersonas(prev => [...prev, newPersona]);
      setSelectedPersona(newPersona);
    } catch (error) {
      console.error('Error generating persona:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const rerollPersona = async (personaId) => {
    try {
      const response = await fetch(`${orchestratorUrl}/reroll-persona`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evmAddress: userAddress,
          personaId
        })
      });

      const updatedPersona = await response.json();
      setPersonas(prev => 
        prev.map(p => p.id === personaId ? updatedPersona : p)
      );
    } catch (error) {
      console.error('Error rerolling persona:', error);
    }
  };

  return (
    <div className="persona-manager">
      <div className="persona-header">
        <h2>Your AI Personas</h2>
        <button 
          onClick={() => generatePersona()}
          disabled={isGenerating}
          className="generate-button"
        >
          {isGenerating ? 'Generating...' : '🎭 Generate New Persona'}
        </button>
      </div>

      <div className="personas-grid">
        {personas.map(persona => (
          <div 
            key={persona.id} 
            className={`persona-card ${selectedPersona?.id === persona.id ? 'selected' : ''}`}
            onClick={() => setSelectedPersona(persona)}
          >
            <img src={persona.imageUrl} alt={persona.name} />
            <h3>{persona.name}</h3>
            <p>{persona.description}</p>
            <div className="persona-traits">
              <span>Confidence: {persona.confidence}/10</span>
              <span>Charm: {persona.charm}/10</span>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                rerollPersona(persona.id);
              }}
              className="reroll-button"
            >
              🎲 Reroll
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonaManager;
```

## Styling

### CSS Styles

```css
/* styles/chat.css */
.ai-chat-interface {
  display: flex;
  flex-direction: column;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.chat-header {
  padding: 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.current-persona {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-persona img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
}

.user-message {
  align-self: flex-end;
  background: #007bff;
  color: white;
}

.ai-message {
  align-self: flex-start;
  background: #f8f9fa;
  color: #333;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ai-avatar {
  font-size: 24px;
  min-width: 32px;
}

.system-message {
  align-self: center;
  background: #e8f5e8;
  color: #2d5a2d;
  font-style: italic;
}

.error-message {
  align-self: center;
  background: #ffe6e6;
  color: #cc0000;
}

.input-container {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
}

.input-container input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 20px;
  outline: none;
}

.input-container button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.input-container button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.transaction-preview {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-status {
  background: #ff6b35;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.label {
  font-weight: bold;
  color: #666;
}

.value.code {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.preview-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.approve-button {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.reject-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
```

## Complete Example

```javascript
// App.jsx - Complete integration example
import React, { useState, useEffect } from 'react';
import { ethers } from "ethers";
import { getVaults, createIntuAccount } from '@intuweb3/web-kit';
import AIChatInterface from './components/AIChatInterface';
import PersonaManager from './components/PersonaManager';
import './styles/chat.css';

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userVaults, setUserVaults] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    initializeConnection();
  }, []);

  const initializeConnection = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const vaults = await getVaults(address, provider);

        setProvider(provider);
        setSigner(signer);
        setUserAddress(address);
        setUserVaults(vaults);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    }
  };

  const createFirstVault = async () => {
    try {
      const newVault = await createIntuAccount(
        [userAddress],
        "My AI Assistant Vault",
        1, 1, 1,
        signer
      );
      
      setUserVaults(prev => [...prev, newVault]);
    } catch (error) {
      console.error('Error creating vault:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="app">
        <div className="connection-prompt">
          <h1>Connect Your Wallet</h1>
          <p>Please connect your wallet to start using AI-powered Web3 features</p>
          <button onClick={initializeConnection}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI-Powered Web3 Assistant</h1>
        <div className="user-info">
          <span>👤 {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
          <span>🏦 {userVaults.length} Vaults</span>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          className={activeTab === 'chat' ? 'active' : ''}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
        <button 
          className={activeTab === 'personas' ? 'active' : ''}
          onClick={() => setActiveTab('personas')}
        >
          🎭 Personas
        </button>
      </nav>

      <main className="app-main">
        {userVaults.length === 0 ? (
          <div className="empty-state">
            <h2>Create Your First INTU Vault</h2>
            <p>Create a vault to start using AI-powered Web3 features</p>
            <button onClick={createFirstVault}>
              🏦 Create Vault
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chat' && (
              <AIChatInterface
                userAddress={userAddress}
                userVaults={userVaults}
                provider={provider}
                signer={signer}
                orchestratorUrl="http://localhost:3005"
              />
            )}
            {activeTab === 'personas' && (
              <PersonaManager
                userAddress={userAddress}
                orchestratorUrl="http://localhost:3005"
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
```

## Next Steps

1. **[Deploy MCP Server](./mcp-server.md)** - Set up the AI backend
2. **[Configure Orchestrator](./orchestrator.md)** - Connect AI to blockchain
3. **[Explore Examples](./examples.md)** - See complete implementations

---

**Ready to build intelligent Web3 interfaces with [INTU Web-Kit](https://docs.intu.xyz/build/sdk/start/).** 