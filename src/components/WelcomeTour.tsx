import { useState, useEffect } from "react";

interface WelcomeTourProps {
  onComplete: () => void;
}

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to 3Tee Chat!",
      content: "Your intelligent AI chat companion with advanced features and beautiful design.",
      target: null,
    },
    {
      title: "Create New Chats",
      content: "Click the 'New Chat' button to start a conversation with AI. Each chat can use different models.",
      target: "new-chat-button",
    },
    {
      title: "Choose AI Models",
      content: "Select from different AI models like GPT-4.1 Nano, GPT-4o Mini, Claude, and Gemini for varied responses.",
      target: "model-selector",
    },
    {
      title: "Upload Files",
      content: "Attach images, PDFs, and documents to your messages for AI analysis and discussion.",
      target: "file-upload",
    },
    {
      title: "Keyboard Shortcuts",
      content: "Use Cmd/Ctrl + K to see all keyboard shortcuts. Cmd/Ctrl + N creates a new chat quickly.",
      target: "help-button",
    },
    {
      title: "Customize Settings",
      content: "Access settings to change themes, set default models, and add your own API keys.",
      target: "user-menu",
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
