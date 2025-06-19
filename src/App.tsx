import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { ChatInterface } from "./components/ChatInterface";
import { AuthComponent } from "./components/AuthComponent";
import { ThemeProvider } from "./components/ThemeProvider";
import { ShareLinkHandler } from "./components/ShareLinkHandler";
import { Toaster } from "sonner";

function App() {

    return (
        <ThemeProvider>
                <BrowserRouter>
                    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900">
                        <AuthLoading>
                            <></>
                        </AuthLoading>
                        <Unauthenticated>
                            <AuthComponent />
                        </Unauthenticated>

                        <Authenticated>
                            <ShareLinkHandler>
                                <Routes>
                                    {/* Default route */}
                                    <Route
                                        path="/"
                                        element={<ChatInterface />}
                                    />
                                    {/* Chat-specific routes */}
                                    <Route
                                        path="/chat/:chatId"
                                        element={<ChatInterface />}
                                    />
                                    {/* Project-specific routes */}
                                    <Route
                                        path="/project/:projectId"
                                        element={<ChatInterface />}
                                    />
                                    {/* Share link routes */}
                                    <Route
                                        path="/share/chat/:shareId"
                                        element={<ChatInterface />}
                                    />
                                    <Route
                                        path="/share/project/:shareId"
                                        element={<ChatInterface />}
                                    />
                                    {/* Fallback to home */}
                                    <Route
                                        path="*"
                                        element={<Navigate to="/" replace />}
                                    />
                                </Routes>
                            </ShareLinkHandler>
                        </Authenticated>

                        <Toaster
                            theme="dark"
                            position="top-right"
                            toastOptions={{
                                style: {
                                    background: "rgba(0, 0, 0, 0.8)",
                                    border: "1px solid rgba(139, 92, 246, 0.3)",
                                    color: "rgb(196, 181, 253)",
                                },
                            }}
                        />

                        {/* Animated background particles */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {Array.from({ length: 30 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-1 h-1 bg-white rounded-full opacity-10"
                                    style={{
                                        left: `${Math.random() * 100}%`,
                                        top: `${Math.random() * 100}%`,
                                        animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
                                        animationDelay: `${Math.random() * 3}s`,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Floating orbs */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={`orb-${i}`}
                                    className="absolute rounded-full bg-gradient-to-r from-purple-600/10 to-pink-600/10 backdrop-blur-sm"
                                    style={{
                                        width: `${50 + Math.random() * 100}px`,
                                        height: `${50 + Math.random() * 100}px`,
                                        left: `${Math.random() * 100}%`,
                                        top: `${Math.random() * 100}%`,
                                        animation: `floatSlow ${8 + Math.random() * 10}s ease-in-out infinite`,
                                        animationDelay: `${Math.random() * 5}s`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
