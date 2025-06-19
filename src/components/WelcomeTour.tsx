import { useState, useEffect } from "react";

interface WelcomeTourProps {
  onComplete: () => void;
}

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to 3Tee Chat! 🚀",
      content: "Your cross-platform AI chat experience, built from real community feedback. Chat with multiple AI models, organize projects, and export everything!",
      target: null,
    },
    {
      title: "🤖 Multi-Model AI Power",
      content: "Switch between OpenAI GPT, Google Gemini, Anthropic Claude, and more. Each model brings unique strengths to your conversations.",
      target: "model-selector",
    },
    {
      title: "🎨 AI Image & Video Generation",
      content: "Generate stunning images with DALL-E or create videos with AI models. Your creative companion for visual content creation.",
      target: "ai-generation",
    },
    {
      title: "🔍 Real-Time Web Search",
      content: "Get up-to-date information with live web search integration. AI responses include current data with transparent source citations.",
      target: "web-search",
    },
    {
      title: "🎤 Smart Voice Features",
      content: "Record voice messages with real-time transcription, upload images and PDFs, or use custom 'buzz words' to auto-send recordings.",
      target: "file-upload",
    },
    {
      title: "⚡ Live Chat Streaming",
      content: "Experience real-time AI responses with typing indicators and resumable streams. Never lose context, even after interruptions.",
      target: "live-chat",
    },
    {
      title: "🌿 Advanced Conversation Flow",
      content: "Edit any message to create conversation branches. Fork entire chats or projects to explore different paths without losing original context.",
      target: "message-list",
    },
    {
      title: "🗺️ Chat Navigation & Outline",
      content: "Navigate complex conversations with visual outlines. Jump between message threads and see conversation structure at a glance.",
      target: "chat-navigator",
    },
    {
      title: "📁 Project Forking & Organization",
      content: "Fork projects to experiment safely. Toggle between Chat view and Project view (Ctrl+Shift+P) with hierarchical organization.",
      target: "sidebar",
    },
    {
      title: "🔗 Universal Sharing & Export",
      content: "Generate shareable links, export to Markdown/JSON/PDF, or collaborate in real-time. Your data, your way.",
      target: "share-menu",
    },
    {
      title: "⌨️ Keyboard Power User Mode",
      content: "Press Ctrl+K for shortcuts. Navigate chats with arrows, create branches, export files, and control everything without touching your mouse!",
      target: "help-button",
    },
    {
      title: "🎨 Beautiful & Cross-Platform",
      content: "Enjoy glassmorphism design, custom themes, and a responsive interface that works perfectly on web, desktop, and mobile.",
      target: "theme-toggle",
    },
  ];

  const currentStepData = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800/95 backdrop-blur-sm border border-purple-500/30 rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-purple-400' : 'bg-purple-500/30'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-purple-400">
              {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Content */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-purple-100 mb-3">
              {currentStepData.title}
            </h2>
            <p className="text-purple-200 leading-relaxed">
              {currentStepData.content}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={skipTour}
              className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
            >
              Skip tour
            </button>
            
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="px-4 py-2 text-purple-300 hover:text-purple-200 transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
