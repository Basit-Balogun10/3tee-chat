## **3Tee Chat Clone: The Feedback-Driven, Cross-Platform Engine**

**Live Demo:** `3tee.chat` | **Desktop App:** [Downloads] | **Mobile APK:** [Link] | **Sister Project:** `basit.chat`

This isn't just a 3Tee Chat clone. It's a feedback-driven, architecturally-sound chat ecosystem built in 10 days. It runs on web, desktop, and mobile, all from a single, reusable codebase.

### The Journey: From Portfolio to Cloneathon

My journey to this project was unconventional. It started with a personal mission: to build an **AI portfolio** (`basit.chat`) to solve the "stateless resume" problem and stand out in a tough job market.

While researching, I saw Theo's post asking for community feedback on `3Tee.chat` and saw he was having issues with the AI tools analyzing the replies. Recognizing a real-time problem I could solve, I pivoted. I started scraping and analyzing the hundreds of replies to give him a clean, categorized dataset of what the community wanted.

Midway through my analysis, the **[3Tee Cloneathon](https://cloneathon.3Tee.chat/)** was announced. It was the perfect opportunity to merge both goals. I finished the feedback analysis anyway and sent it over in a GitHub Gist—as an act of good faith. The Cloneathon itself then became the main quest: to build the clone the community was actually asking for.

### The Architecture: Building for Scale and Speed

This project was built on a modern, scalable monorepo architecture using `pnpm` workspaces. The goal was to build a reusable "engine" of components and logic that could power multiple applications, not just a single one.

- **The Engine (`packages/`):** Core UI components, Convex backend functions, and shared types were built as reusable packages.
- **The Applications (`apps/`):** The final Web, Desktop, Mobile, and Portfolio apps are all consumers of this core engine.
- **The Tech Stack:**
    - **Frontend:** Vite, React, TypeScript, Tailwind CSS
    - **Backend & Database:** Convex
    - **Cross-Platform:** **[Tauri v2](https://v2.tauri.app/)** for native Desktop and Mobile builds.

This decoupled architecture is what allowed me to build with such speed and to deploy the same core experience across four different platforms.

### Features Checklist

#### ✅ Core Requirements Met

- **Chat with Various LLMs:** Supports multiple language models via a clean, selectable interface.
- **Authentication & Sync:** Full user authentication with synchronized chat history across all devices.

#### ✨ Bonus Features Implemented

- **Beautiful Syntax Highlighting:** For all code blocks.
- **Resumable Streams:** Continue generating text even after a page refresh.
- **Chat Sharing:** Generate a unique, public link to share conversations.
- **Chat Branching:** Fork conversations by editing previous messages.
- **Attachment Support:** Upload images and PDFs directly into the chat.
- **Web Search:** Integrate real-time web search capabilities to answer current events.

#### 💡 Community-Driven Features (My Unfair Advantage)

I built these features directly from my analysis of the community feedback on X:

- **Feature 1:** [Example: "Show Sources" - Each AI response cites the context it used.]
- **Feature 2:** [Example: "Improved Error Handling" - Clean, user-friendly modals for API key errors or network issues.]
- **Feature 3:** [Example: "Keyboard-First Navigation" - Full app control using keyboard shortcuts.]

### The Ultimate Flex: The AI Portfolio

The core engine of this project is so robust and reusable that I was also able to rapidly deploy my original project idea: a personal AI portfolio powered by the same components and backend logic.

It runs on the same engine, but uses a different knowledge base—my personal career story.

**You can talk to it here: [basit.chat](https://basit.chat)**
