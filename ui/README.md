# UI - Modern Web3 Experience

> **Beautiful, responsive interface for AI-powered personas and blockchain interactions**

The UI component is the user-facing frontend of INTU Persona Demo. Built as a modern Progressive Web App (PWA), it provides an intuitive interface for creating AI personas, chatting with intelligent agents, and executing blockchain transactions seamlessly.

## 🎯 What It Offers

### 🎨 **Modern User Experience**
- **Progressive Web App**: Full PWA capabilities with offline support
- **Mobile-First Design**: Responsive layout optimized for all devices
- **Real-Time Chat**: Streaming AI responses with smooth animations
- **Dark/Light Mode**: Adaptive theming for user preference

### 🔐 **Seamless Authentication**
- **SSO Integration**: Single sign-on with popular providers
- **Wallet Connection**: Automatic EVM account creation
- **Session Management**: Secure, privacy-focused state handling
- **No Data Persistence**: Privacy-first approach with no local storage

### 🎭 **Persona Management**
- **Interactive Creation**: Guided persona generation workflow
- **Visual Feedback**: Real-time preview of persona traits
- **Reroll System**: Easy persona regeneration (up to 3 times)
- **NFT Visualization**: Beautiful display of persona as NFT

### 💬 **Intelligent Chat Interface**
- **Contextual Conversations**: AI remembers your persona and preferences
- **Streaming Responses**: Real-time message delivery
- **Rich Content**: Support for text, images, and interactive elements
- **Transaction Integration**: Execute blockchain transactions directly in chat

## 🛠️ Tech Stack

**Framework & Build**
- **Vite**: Lightning-fast build tool and dev server
- **React 18**: Modern React with concurrent features
- **TypeScript**: Full type safety throughout the application

**Styling & UI**
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Beautiful, accessible UI components
- **Lucide Icons**: Consistent iconography
- **CSS Variables**: Dynamic theming support

**State Management**
- **Zustand**: Lightweight, intuitive state management
- **No Persistence**: Privacy-focused approach
- **Reactive Updates**: Efficient re-rendering

**Web3 Integration**
- **Ethers.js**: Ethereum blockchain interaction
- **INTU SDK**: Unified execution layer
- **Wallet Connect**: Multi-wallet support

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- Running Orchestrator (for API endpoints)
- Modern web browser

### Installation

```bash
# Clone the main repository
git clone https://github.com/intu-labs/intu-persona-demo.git
cd intu-persona-demo/ui

# Install dependencies
pnpm install  # or npm install
```

### Development

```bash
# Start development server
pnpm run dev

# Access the application
# http://localhost:5173
```

### Production Build

```bash
# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Serve static files
pnpm run serve
```

## 🏗️ Project Structure

```
ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── chat/           # Chat interface components
│   │   ├── ui/             # Shadcn/ui components
│   │   ├── layouts/        # Layout components
│   │   └── providers/      # Context providers
│   ├── lib/                # Utility functions and configs
│   │   ├── store.ts        # Zustand store configuration
│   │   ├── utils.ts        # General utilities
│   │   └── constants.ts    # App constants
│   ├── assets/             # Static assets
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Application entry point
├── public/                 # Static files
├── index.html              # HTML template
└── vite.config.ts          # Vite configuration
```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the ui directory:

```bash
# API Endpoints
VITE_ORCHESTRATOR_URL=http://localhost:3005
VITE_MCP_SERVER_URL=http://localhost:3000

# Blockchain Configuration
VITE_CHAIN_ID=421614
VITE_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Feature Flags
VITE_ENABLE_WALLET=true
VITE_ENABLE_TRANSACTIONS=true
VITE_DEBUG_MODE=false
```

### Theming

The app supports custom theming through CSS variables:

```css
/* Custom theme in src/index.css */
:root {
  --primary: 222.2 84% 4.9%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  /* ... more theme variables */
}
```

## 🧩 Key Components

### Chat Interface
```typescript
// components/chat/chat-interface.tsx
import { ChatInterface } from '@/components/chat/chat-interface';

<ChatInterface 
  sessionId="user-123"
  onMessage={handleMessage}
  streaming={true}
/>
```

### Persona Display
```typescript
// Display user's persona
import { PersonaCard } from '@/components/persona-card';

<PersonaCard 
  persona={userPersona}
  onReroll={handleReroll}
  rerollsRemaining={3}
/>
```

### Wallet Connection
```typescript
// components/wallet-connect.tsx
import { WalletConnect } from '@/components/wallet-connect';

<WalletConnect 
  onConnect={handleWalletConnect}
  supportedChains={[arbitrumSepolia]}
/>
```

## 🔗 API Integration

### Orchestrator Communication
```typescript
// lib/api.ts
export const sendMessage = async (sessionId: string, message: string) => {
  const response = await fetch(`${ORCHESTRATOR_URL}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  });
  return response.json();
};
```

### State Management
```typescript
// lib/store.ts
import { create } from 'zustand';

interface AppState {
  user: User | null;
  persona: Persona | null;
  chatHistory: Message[];
  setUser: (user: User) => void;
  setPersona: (persona: Persona) => void;
  addMessage: (message: Message) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  persona: null,
  chatHistory: [],
  setUser: (user) => set({ user }),
  setPersona: (persona) => set({ persona }),
  addMessage: (message) => set((state) => ({
    chatHistory: [...state.chatHistory, message]
  })),
}));
```

## 🎨 Styling Guidelines

### Component Styling
- Use Tailwind CSS classes for consistent styling
- Leverage CSS variables for theme-aware colors
- Follow mobile-first responsive design principles

### Color Scheme
```css
/* Primary colors */
.bg-primary     /* Main brand color */
.bg-secondary   /* Secondary brand color */
.bg-accent      /* Accent color for highlights */
.bg-muted       /* Subtle backgrounds */

/* Semantic colors */
.text-destructive  /* Error states */
.text-success      /* Success states */
.text-warning      /* Warning states */
```

### Component Variants
```typescript
// Using cva for component variants
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
  }
);
```

## 🚀 Performance Optimizations

### Code Splitting
```typescript
// Lazy load components
import { lazy, Suspense } from 'react';

const PersonaGenerator = lazy(() => import('./components/PersonaGenerator'));

// Usage with suspense
<Suspense fallback={<Loading />}>
  <PersonaGenerator />
</Suspense>
```

### Asset Optimization
- **Images**: Optimized with proper formats (WebP, AVIF)
- **Fonts**: Preloaded for better performance
- **Icons**: Tree-shaken from Lucide React
- **Bundle**: Analyzed and optimized with Vite

### Caching Strategy
```typescript
// Service worker for offline support
// src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
```

## 🧪 Testing

### Unit Tests
```bash
# Run tests
pnpm run test

# Run tests with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm run test:watch
```

### E2E Tests
```bash
# Run Playwright tests
pnpm run test:e2e

# Run tests in headed mode
pnpm run test:e2e:headed
```

### Component Testing
```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import { ChatInterface } from './chat-interface';

test('renders chat interface', () => {
  render(<ChatInterface sessionId="test" />);
  expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
});
```

## 🔧 Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
pnpm install

# Clear Vite cache
pnpm run dev --force
```

**API Connection Issues**
- Verify orchestrator is running on correct port
- Check CORS settings in orchestrator
- Ensure environment variables are set correctly

**Wallet Connection Problems**
- Check if wallet extension is installed
- Verify network configuration
- Ensure proper RPC endpoints

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('debug', 'true');

// Or set in environment
VITE_DEBUG_MODE=true
```

## 🤝 Contributing

We welcome contributions to improve the UI:

### Development Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Run linting
pnpm run lint

# Format code
pnpm run format
```

### Contribution Areas
- **Accessibility**: Improve WCAG compliance
- **Performance**: Optimize loading and rendering
- **Features**: Add new UI components and interactions
- **Design**: Enhance visual design and UX

## 📱 PWA Features

### Installation
- **Add to Home Screen**: Prompt users to install the app
- **Offline Support**: Basic functionality without internet
- **Push Notifications**: Updates about persona generation

### Manifest Configuration
```json
{
  "name": "INTU Persona Demo",
  "short_name": "Persona Demo",
  "description": "Create and interact with AI personas on blockchain",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait"
}
```

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Part of the [INTU Persona Demo](../) ecosystem**
