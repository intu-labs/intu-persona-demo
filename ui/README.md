# INTU Persona Demo

A mobile-first, chat-centric Progressive Web Application (PWA) that allows users to create, own, and interact with unique AI Agent personas.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Export Instructions](#export-instructions)
- [Integration with Backend](#integration-with-backend)
- [State Management](#state-management)
- [Theming and Styling](#theming-and-styling)
- [Components](#components)
- [Hooks](#hooks)
- [Customization](#customization)
- [PWA Configuration](#pwa-configuration)
- [Dependencies](#dependencies)
- [Additional Export Considerations](#additional-export-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

INTU Persona Demo is a Next.js application that showcases a modern UI for interacting with AI personas. The application features a chat interface, persona management, and data connection capabilities. It's designed to be mobile-first and responsive, with a focus on micro-interactions and a clean, modern aesthetic.

## Features

- **Chat Interface**: Real-time chat with AI personas
- **Persona Management**: Create, customize, and reroll AI personas
- **Authentication**: Login with various providers
- **Data Connection**: Connect private data sources
- **Theme Support**: Light/dark mode and persona-specific themes
- **Progressive Web App**: Installable on mobile devices
- **Responsive Design**: Mobile-first approach with desktop support

## Project Structure

\`\`\`
intu-persona-demo/
├── app/                    # Next.js App Router files
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── manifest.ts         # PWA manifest
│   └── page.tsx            # Home page
├── components/             # React components
│   ├── auth/               # Authentication components
│   ├── chat/               # Chat interface components
│   ├── data/               # Data connection components
│   ├── layouts/            # Layout components
│   ├── persona/            # Persona management components
│   ├── providers/          # Context providers
│   ├── settings/           # Settings components
│   └── ui/                 # UI components (shadcn/ui)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── public/                 # Static assets
├── tailwind.config.ts      # Tailwind configuration
└── next.config.mjs         # Next.js configuration
\`\`\`

## Installation

1. **Clone the repository**

\`\`\`bash
git clone <repository-url>
cd intu-persona-demo
\`\`\`

2. **Install dependencies**

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

3. **Run the development server**

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

4. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## Export Instructions

### Using v0.dev's Download Code Feature

The easiest way to export this project is using v0.dev's built-in download feature:

1. **Click the "Download Code" button** in the top-right corner of the v0.dev interface
2. **Select your preferred download option**:
   - Download as ZIP
   - Copy installation command

3. **Using the shadcn CLI command**:

\`\`\`bash
# Create a new Next.js project if you don't have one
npx create-next-app@latest my-intu-app
cd my-intu-app

# Install the INTU Persona Demo using the shadcn CLI
npx shadcn@latest add "https://v0.dev/chat/b/b_2W6jie1rrU0"
\`\`\`

This command will:
- Install all necessary dependencies
- Add all components to your project
- Configure Tailwind CSS
- Set up the required files and structure

4. **After installation, check that all files were properly added**:
   - Verify that `app/globals.css` contains all the CSS variables
   - Ensure `tailwind.config.ts` has all the required theme extensions
   - Check that all components are in the `components` directory

5. **Start the development server**:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

### Manual Export

If you prefer to manually export the code:

1. **Download the ZIP file** from v0.dev
2. **Extract the files** to your project directory
3. **Install the required dependencies**:

\`\`\`bash
npm install next react react-dom tailwindcss postcss autoprefixer tailwindcss-animate lucide-react next-themes react-markdown
# or
yarn add next react react-dom tailwindcss postcss autoprefixer tailwindcss-animate lucide-react next-themes react-markdown
# or
pnpm add next react react-dom tailwindcss postcss autoprefixer tailwindcss-animate lucide-react next-themes react-markdown
\`\`\`

4. **Copy the files** to your project structure
5. **Configure Tailwind CSS**:

\`\`\`bash
npx tailwindcss init -p
\`\`\`

6. **Replace the generated `tailwind.config.js` with the provided `tailwind.config.ts`**

## Integration with Backend

### API Integration

The current implementation uses simulated responses. To integrate with a real backend:

1. **Update the `AppProvider` in `components/providers/app-provider.tsx`**:
   - Replace the simulated persona generation with API calls
   - Update the message handling to use your backend API

2. **Implement Authentication**:
   - Update the `LoginModal` component to use your authentication service
   - Modify the `useApp` hook to handle authentication tokens

3. **Connect Data Sources**:
   - Update the `ConnectDataModal` component to connect to your data sources
   - Implement proper data fetching and storage

### Example API Integration

\`\`\`typescript
// Example API call for persona generation
const rerollPersona = async () => {
  if (!persona || persona.rerollsLeft <= 0) return

  try {
    // Replace with your API endpoint
    const response = await fetch('/api/personas/reroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        currentPersonaId: persona.id,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to reroll persona')
    }

    const newPersona = await response.json()
    setPersona(newPersona)
  } catch (error) {
    console.error('Error rerolling persona:', error)
    throw error
  }
}
\`\`\`

### Chat Integration

To integrate with a real AI backend:

1. **Update the `handleSendMessage` function in `ChatInterface`**:

\`\`\`typescript
const handleSendMessage = async (content: string) => {
  if (!content.trim()) return

  // Add user message
  const userMessage = {
    id: Date.now().toString(),
    content,
    sender: "user",
    timestamp: new Date(),
  }
  addMessage(userMessage)

  try {
    // Call your AI backend
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        personaId: persona?.id,
        userId: user.id,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get response')
    }

    const aiResponse = await response.json()
    
    addMessage({
      id: Date.now().toString(),
      content: aiResponse.text,
      sender: "agent",
      timestamp: new Date(),
      isMarkdown: aiResponse.isMarkdown || false,
    })
  } catch (error) {
    console.error('Error getting AI response:', error)
    addMessage({
      id: Date.now().toString(),
      content: "Sorry, I encountered an error. Please try again.",
      sender: "agent",
      timestamp: new Date(),
    })
  }
}
\`\`\`

## State Management

The application uses React Context for state management. For larger applications, you might want to migrate to Zustand:

### Migrating to Zustand

1. **Install Zustand**:

\`\`\`bash
npm install zustand
# or
yarn add zustand
# or
pnpm add zustand
\`\`\`

2. **Create a store**:

\`\`\`typescript
// store/app-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PersonaTheme = "default" | "bohemian" | "alien" | "militant" | "fashionable"

type Persona = {
  id: string
  name: string
  description: string
  theme: PersonaTheme
  imageUrl: string
  backgroundUrl: string
  rerollsLeft: number
}

type Message = {
  id: string
  content: string
  sender: "user" | "agent"
  timestamp: Date
  isMarkdown?: boolean
}

interface AppState {
  isLoggedIn: boolean
  isDataConnected: boolean
  isSidebarOpen: boolean
  persona: Persona | null
  messages: Message[]
  setLoggedIn: (value: boolean) => void
  setDataConnected: (value: boolean) => void
  setSidebarOpen: (value: boolean) => void
  setPersona: (persona: Persona | null) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
  rerollPersona: () => Promise<void>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      isDataConnected: false,
      isSidebarOpen: true,
      persona: null,
      messages: [],
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      setDataConnected: (value) => set({ isDataConnected: value }),
      setSidebarOpen: (value) => set({ isSidebarOpen: value }),
      setPersona: (persona) => set({ persona }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      clearMessages: () => set({ messages: [] }),
      rerollPersona: async () => {
        const { persona } = get()
        if (!persona || persona.rerollsLeft <= 0) return

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const themes: PersonaTheme[] = ["bohemian", "alien", "militant", "fashionable"]
        const randomTheme = themes[Math.floor(Math.random() * themes.length)]

        const names = ["Zephyr", "Nova", "Atlas", "Echo", "Orion", "Luna", "Sage", "Iris"]
        const randomName = names[Math.floor(Math.random() * names.length)]

        set({
          persona: {
            ...persona,
            name: randomName,
            theme: randomTheme,
            rerollsLeft: persona.rerollsLeft - 1,
            imageUrl: `/placeholder.svg?height=400&width=400&text=${randomName}`,
          }
        })
      },
    }),
    {
      name: 'intu-app-storage',
    }
  )
)
\`\`\`

3. **Replace Context usage with Zustand**:

\`\`\`typescript
// In components
import { useAppStore } from '@/store/app-store'

export function MyComponent() {
  const { isLoggedIn, setLoggedIn } = useAppStore()
  
  // Use the state and actions
  return (
    // ...
  )
}
\`\`\`

## Theming and Styling

### CSS Variables

The application uses CSS variables for theming. These are defined in `app/globals.css`. The main themes are:

- **Light Mode**: Default light theme
- **Dark Mode**: Default dark theme
- **Persona Themes**: Bohemian, Alien, Militant, Fashionable

### Tailwind Configuration

The Tailwind configuration is in `tailwind.config.ts`. It includes:

- Custom colors based on CSS variables
- Extended theme properties
- Animation configurations

### Adding New Themes

To add a new persona theme:

1. **Add the theme to the `PersonaTheme` type in `app-provider.tsx`**:

\`\`\`typescript
type PersonaTheme = "default" | "bohemian" | "alien" | "militant" | "fashionable" | "your-new-theme"
\`\`\`

2. **Add the theme CSS variables in `globals.css`**:

\`\`\`css
/* Persona Theme: Your New Theme */
.theme-your-new-theme {
  --background: 200 50% 10%;
  --foreground: 200 100% 90%;
  /* Add all required variables */
}
\`\`\`

## Components

### Main Components

- **MainLayout**: Main layout wrapper
- **ChatInterface**: Chat interface container
- **ChatMessages**: Message display
- **ChatInput**: Message input
- **Sidebar**: Side navigation
- **Header**: Top navigation
- **PersonaProfile**: Persona display
- **SettingsPopup**: Settings menu
- **LoginModal**: Authentication modal
- **ConnectDataModal**: Data connection modal

### UI Components

The application uses shadcn/ui components. These are imported from `@/components/ui`.

## Hooks

### Custom Hooks

- **useApp**: Access app state
- **useLocalStorage**: Persist data in localStorage
- **useMediaQuery**: Responsive design helper

### Adding New Hooks

Example of adding a new hook:

\`\`\`typescript
// hooks/use-debounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
\`\`\`

## Customization

### Persona Customization

To add more persona customization options:

1. **Expand the `Persona` type in `app-provider.tsx`**:

\`\`\`typescript
type Persona = {
  id: string
  name: string
  description: string
  theme: PersonaTheme
  imageUrl: string
  backgroundUrl: string
  rerollsLeft: number
  // New fields
  voiceId?: string
  personality?: string[]
  knowledge?: string[]
}
\`\`\`

2. **Update the UI components to use these new fields**

### UI Customization

To customize the UI:

1. **Update the CSS variables in `globals.css`**
2. **Modify the Tailwind configuration in `tailwind.config.ts`**
3. **Update component styles as needed**

## PWA Configuration

The application is configured as a Progressive Web App (PWA) using the Next.js App Router. The PWA configuration is in `app/manifest.ts`.

### Customizing the PWA

To customize the PWA:

1. **Update the manifest in `app/manifest.ts`**
2. **Add or update icons in the `public` directory**
3. **Configure offline support if needed**

## Dependencies

- **Next.js**: React framework
- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: UI component library
- **Lucide React**: Icon library
- **next-themes**: Theme management
- **React Markdown**: Markdown rendering

## Additional Export Considerations

When exporting and integrating this project into your environment, keep the following in mind:

1. **Dependencies**: Make sure to install all required dependencies:
   - next
   - react
   - react-dom
   - tailwindcss
   - postcss
   - autoprefixer
   - tailwindcss-animate
   - lucide-react
   - next-themes
   - react-markdown

2. **shadcn/ui Components**: The project uses shadcn/ui components. You'll need to install these using the shadcn CLI or copy them from the export. If you're using the shadcn CLI command for installation, these will be included automatically.

3. **Fonts**: The project uses Inter and Space Grotesk fonts from Google Fonts. Make sure to include these in your project by adding them to your layout.tsx file:

   \`\`\`tsx
   import { Inter, Space_Grotesk } from 'next/font/google'
   
   const inter = Inter({
     subsets: ["latin"],
     variable: "--font-inter",
   })
   
   const spaceGrotesk = Space_Grotesk({
     subsets: ["latin"],
     variable: "--font-space-grotesk",
   })
   \`\`\`

4. **Icons**: The project uses Lucide React icons. Make sure to install this package and import icons correctly.

5. **CSS Variables**: Ensure all CSS variables in globals.css are properly defined. These are critical for the theming system to work correctly.

6. **Tailwind Configuration**: The tailwind.config.ts file includes custom theme extensions. Make sure this file is properly copied to your project.

7. **Testing**: Before deploying, test the application thoroughly to ensure all components and features work as expected.

8. **Browser Compatibility**: Test the application in different browsers to ensure cross-browser compatibility.

9. **Mobile Responsiveness**: Verify that the application works correctly on different screen sizes and devices.

10. **Performance Optimization**: Consider implementing performance optimizations like code splitting, lazy loading, and image optimization.

## Troubleshooting

### Common Issues

1. **Styling Issues**:
   - Ensure all CSS variables are properly defined in `globals.css`
   - Check that the Tailwind configuration includes all necessary theme extensions

2. **State Management Issues**:
   - Check that the `AppProvider` is wrapping your application
   - Verify that you're using the `useApp` hook correctly

3. **Component Rendering Issues**:
   - Ensure components are properly imported
   - Check for missing dependencies
   - Verify that conditional rendering logic is correct

4. **PWA Issues**:
   - Ensure the manifest is properly configured
   - Check that all required icons are available
   - Verify that the service worker is registered correctly

### Getting Help

If you encounter issues not covered in this documentation, please:

1. Check the project repository for open issues
2. Consult the Next.js and Tailwind CSS documentation
3. Reach out to the project maintainers

---

This README provides a comprehensive guide to the INTU Persona Demo project. For more detailed information about specific components or features, please refer to the code comments and documentation within each file.
