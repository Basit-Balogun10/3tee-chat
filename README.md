# 🚀 3Tee Chat Clone: The Feedback-Driven AI Chat Revolution

> **An AI Chat Experience, Feedback-Forged. Universally Cross-Platform.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-3tee.chat-blue?style=for-the-badge)](https://3tee-chat.vercel.app/)
[![GitHub](https://img.shields.io/badge/⭐_Star_on_GitHub-black?style=for-the-badge&logo=github)](https://github.com/Basit-Balogun10/3tee-chat)

## 🎯 What Makes This Special?

This isn't just another chat clone. This is a **feedback-driven, architecturally-sound chat ecosystem** built in **10 days** that runs on **web, desktop, and mobile** from a **single, reusable codebase**. It's powered by real community insights and built for the future of AI interaction.

### ✨ The Magic: ONE Codebase, EVERY Platform
- 🌐 **Web**: Blazing fast SPA with glassmorphism UI
- 💻 **Desktop**: Native Windows, MacOS, Linux apps via Tauri v2
- 📱 **Mobile**: Native Android & iOS apps (same Tauri magic!)  
- 🔄 **Realtime Sync**: Your chats, projects, and preferences everywhere, always thanks to Convex

---

## 🌟 Noble Features That Will Blow Your Mind

### 🎮 **Core AI Capabilities**
- **🤖 Multi-Provider AI Models**: Seamlessly switch between OpenAI, Google Gemini, Anthropic Claude, and OpenRouter models with intelligent fallbacks
- **🎨 Image Generation**: Create stunning visuals with AI-powered image generation directly in chat conversations
- **🎬 Video Generation**: Generate and preview video content using cutting-edge AI models (future-ready infrastructure)
- **💬 Live Chat Mode**: Real-time streaming responses with typing indicators and instant feedback loops
- **🔍 Real-Time Web Search**: Stay current with live web integration that cites sources and provides up-to-date information
- **🎤 Smart Voice Recording**: Record voice messages with real-time transcription and configurable "buzz words" to auto-send when you say specific phrases

### 🧠 **Advanced Conversation Management**
- **🌿 Internal Message Branching**: Edit any message to create internal conversation branches - explore multiple pathways within a single conversation thread
- **🍴 Project & Chat Forking**: Fork entire conversations or projects to experiment with different approaches without losing original context
- **🗺️ Chat Navigation & Outline**: Visual conversation mapping with message threading, branch visualization, and easy navigation between conversation paths
- **📁 Hierarchical Project Organization**: Organize chats into nested projects with beautiful color coding and drag-drop management

### 🎨 **Beautiful Interface & UX**
- **✨ Glassmorphism Design**: Stunning frosted glass effects with backdrop blur, gradient borders, and ethereal aesthetics
- **⌨️ Custom Keyboard Shortcuts**: Fully customizable shortcuts with auto-detection - press key combinations and they're automatically configured

### 🔄 **Export & Data Management**
- **📊 Universal Export System**: Export individual chats, entire projects, or your complete workspace in multiple formats
- **📝 Format Support**: JSON (structured data), Markdown (documentation), CSV (analytics), PDF (sharing), TXT (simple backup)
- **🔗 Advanced Sharing**: Generate public read-only links, collaboration links, or embedded snippets with granular permission control

### 🛠 **Power User Features**
- **🔑 BYOK (Bring Your Own Key)**: Total control with your own API keys for unlimited usage and privacy
- **🚪 Guest Mode**: Zero-barrier entry - jump right in without registration for instant access
- **💾 Resumable Streaming**: Continue AI responses exactly where they left off, even after browser refresh or connection drops
- **🎛️ Advanced Model Selection**: Switch between different AI providers and models mid-conversation with context preservation

---

## 📖 The Epic Journey: From Portfolio Dream to Cloneathon Victory

### 💡 **The Spark: An AI Portfolio Vision**
My journey began with a personal mission: build an AI-powered portfolio to solve the "stateless resume" challenge and truly stand out in a competitive job market. Deep research into AI chat interfaces became my foundation.

### 👁️ **Theo's Feedback Call & The Pivot**
Then I saw Theo's post seeking community feedback on **t3.chat**. He mentioned issues with AI tools analyzing replies. Recognizing a real-time problem I could tackle, I pivoted. I started scraping and analyzing **hundreds of replies** to provide clean, categorized insights.

### 👑 **The 3Tee Cloneathon Emerges**
Mid-analysis, the **3Tee Cloneathon** was announced – perfect timing! It felt like destiny calling.

### 🤝 **Good Faith & The Main Quest**
I completed the feedback analysis anyway and shared it with Theo via GitHub Gist oin his X's DM, as an act of good faith. With that done, the Cloneathon became the main quest: build the AI chat clone the community was actually asking for.

### 🏃‍♂️ **10 Days of Hyper-Development**
An insane deadline fueled an adrenaline-driven sprint. Leveraging a reusable engine, Convex for backend, and Tauri for cross-platform magic, the vision rapidly materialized into this masterpiece.

---

## 🏗️ **Technical Architecture & Smart Decisions**

Built on a robust **PNPM monorepo** with a versatile "engine" of shared components. This isn't just an app; it's a platform I engineered for excellence.

### 🛠️ **Tech Stack**
- **⚡ Vite**: Lightning-fast build tool with HMR
- **⚛️ React 18**: Modern UI with concurrent features  
- **📘 TypeScript**: Strict type safety across the stack
- **🎨 Tailwind CSS**: Utility-first styling with custom design system
- **🗄️ Convex**: Real-time backend with optimistic updates
- **🦀 Tauri v2**: Cross-platform native apps with Rust performance

### 🧠 **Smart Implementation Approaches**

#### **AI Provider Strategy**
- **Azure OpenAI**: Initially planned to use Azure's free credits for cost-effective inference, but hit quota request barriers in final days
- **Fallback Strategy**: Implemented normal OpenAI SDK when users provide their own API keys for maximum flexibility
- **Google Integration**: Used Vertex AI API with our Google Cloud project for free credits, but gracefully switches to standard Gemini API when users provide their own keys
- **Anthropic Approach**: Similar dual strategy - Vertex AI for cost management, native Anthropic SDK for user-provided keys
- **OpenRouter Support**: Full integration for users who want access to additional models (user keys required due to cost considerations)

### 🌍 **Universal Deployment Architecture**
```
📦 ONE Codebase → Multiple Targets
├── 🌐 Web App (Vercel deployment)
├── 💻 Desktop Apps (Tauri builds)
│   ├── Windows (.exe installer)
│   ├── MacOS (.dmg bundle)  
│   └── Linux (.AppImage)
├── 📱 Mobile Apps (Tauri mobile)
│   ├── Android (.apk)
│   └── iOS (.ipa)
└── 🤖 AI Portfolio (separate instance)
```

---
  
## 🚀 **Getting Started**

### 📦 **Quick Setup**

```bash
# Clone the magic
git clone https://github.com/Basit-Balogun10/3tee-chat
cd 3tee-chat

# Install dependencies (uses PNPM workspaces)
pnpm install

# Setup environment
cp .env.example .env
```

### 🧪 **Development Commands**

```bash
# Start the full experience (frontend + backend)
pnpm dev

# Frontend only (Vite dev server)
pnpm dev:frontend

# Backend only (Convex functions)
pnpm dev:backend

# Lint + type check everything
pnpm run lint

# Build for production
pnpm build
```

#### 🖥️ **Desktop Development (Tauri)**

```bash
# Run desktop app in development mode
pnpm tauri dev

# Build desktop app for production
pnpm tauri build
```

#### 📱 **Mobile Development (Tauri)**

```bash
# Android development
pnpm tauri android dev

# iOS development (macOS only)
pnpm tauri ios dev

# Build mobile apps for production
pnpm tauri android build
pnpm tauri ios build
```

**📋 Prerequisites for Mobile:**
- **Android**: Android Studio with SDK tools installed
- **iOS**: Xcode (macOS only) and iOS development certificates
- **Both**: Rust toolchain with mobile targets added

### 🌐 **Environment Variables**

```env
# Convex Configuration
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud
SITE_URL=http://localhost:5173

# Authentication (OAuth providers)
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret
AUTH_GOOGLE_ID=your-google-oauth-id
AUTH_GOOGLE_SECRET=your-google-oauth-secret

# Optional: Voice Features
ASSEMBLYAI_API_KEY=your-assemblyai-key

# Optional: Our Cloud Credits (fallback when users don't provide keys)
AZURE_OPENAI_ENDPOINT=your-azure-endpoint
AZURE_OPENAI_API_KEY=your-azure-key
OPENAI_API_VERSION=2024-02-15-preview
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1

# Optional: Additional Models
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your-openrouter-key
DEEPSEEK_API_KEY=your-deepseek-key
```

---

## 🎯 **Community-Driven Features** 

These features came directly from analyzing **hundreds of community replies** on Theo's original post:

✅ **Smart Voice Integration**: Real-time transcription with configurable trigger words  
✅ **Advanced Branching**: Internal message branching for conversation exploration  
✅ **Export Everything**: Multiple formats for maximum data portability  
✅ **Better Error Handling**: Clean, user-friendly error messages with recovery suggestions  
✅ **Keyboard Navigation**: Full app control via customizable shortcuts  
✅ **Real Collaboration**: Multi-user sharing with permission levels  
✅ **Source Citation**: Transparent AI reasoning with linked sources  

## 🎨 **Feature Showcase**

### **🎤 Smart Voice Recording**
Record voice messages with real-time transcription. Configure custom "buzz words" like "send it" or "that's all" to automatically end recording and send to AI.

### **🌿 Internal Conversation Branching** 
Edit any message in a conversation to create a new branch. Explore multiple conversation paths without losing context - like Git for conversations!

### **🔍 Live Web Search Integration**
AI responses include real-time web search results with source citations. Ask about current events and get up-to-date information with transparency.

### **📊 Universal Export System**
Export individual chats, entire projects, or your complete workspace. Supports JSON (data), Markdown (docs), CSV (analytics), PDF (sharing), and TXT (backup).

### **✨ Glassmorphism UI**
Beautiful frosted glass effects with backdrop blur, gradient borders, and dynamic color systems that adapt to content and user preferences.

---

## 🏅 **Hackathon Highlights**

- ✅ **10-Day Development Sprint**: From concept to cross-platform reality
- ✅ **Community Feedback Integration**: Built on real user insights from 200+ replies  
- ✅ **Cross-Platform Excellence**: One codebase, six deployment targets
- ✅ **Advanced AI Features**: Voice, vision, search, branching, and collaboration

---

## 📄 **License**

Apache 2.0 License - Built with ❤️ for the **T3 Chat Cloneathon**

---

## 🙏 **Acknowledgments**

- **Theo** for inspiring this with the original t3.chat
- **The Community** whose 200+ feedback replies took part in shaping every feature decision
- **The T3 Chat Cloneathon** for providing the perfect stage and deadline pressure
- **Modern Web Ecosystem** (Vite, React, Tauri, Convex) for enabling rapid development
