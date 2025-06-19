import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Github,
    Mail,
    KeyRound,
    Chrome,
    Apple,
    Loader2,
    UserX,
    Zap,
    ArrowRight,
    ArrowLeft,
    Check,
} from "lucide-react";
import { toast } from "sonner";

export function AuthComponent() {
    const { signIn } = useAuthActions();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [authMode, setAuthMode] = useState<"choose" | "email" | "verify">(
        "choose"
    );

    const handleOAuthSignIn = async (provider: "github" | "google") => {
        try {
            setIsLoading(true);
            setLoadingProvider(provider);

            await signIn(provider);
        } catch (error) {
            console.error(`${provider} sign in failed:`, error);
            toast.error(
                `Failed to sign in with ${provider === "github" ? "GitHub" : "Google"}`
            );
        } finally {
            setIsLoading(false);
            setLoadingProvider(null);
        }
    };

    const handleAnonymousSignIn = async () => {
        try {
            setIsLoading(true);
            setLoadingProvider("anonymous");

            await signIn("anonymous");
            toast.success("Welcome! You're now chatting as a guest.");
        } catch (error) {
            console.error("Anonymous sign in failed:", error);
            toast.error("Failed to continue as guest. Please try again.");
        } finally {
            setIsLoading(false);
            setLoadingProvider(null);
        }
    };

    const handleSendOTP = async () => {
        if (!email.trim()) {
            toast.error("Please enter your email address");
            return;
        }

        try {
            setIsLoading(true);

            // Use resend-otp provider to send OTP code
            const formData = new FormData();
            formData.append("email", email.trim());

            await signIn("resend-otp", formData);

            toast.success("Verification code sent to your email!");
            setAuthMode("verify");
        } catch (error) {
            console.error("Email OTP send failed:", error);
            toast.error("Failed to send verification code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!code.trim()) {
            toast.error("Please enter the verification code");
            return;
        }

        try {
            setIsLoading(true);

            // Verify the OTP code
            const formData = new FormData();
            formData.append("email", email.trim());
            formData.append("code", code.trim());

            await signIn("resend-otp", formData);

            toast.success("Successfully signed in!");
        } catch (error) {
            console.error("Code verification failed:", error);
            toast.error("Invalid verification code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const resetAuthFlow = () => {
        setAuthMode("choose");
        setEmail("");
        setCode("");
        setIsLoading(false);
        setLoadingProvider(null);
    };

    if (authMode === "email") {
        return (
            <div className="h-screen flex items-center justify-center">
            <div className="w-full max-w-md mx-auto bg-black/40 backdrop-blur-sm border border-purple-600/30 rounded-2xl p-8 z-50">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                        <Mail className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-purple-100 mb-2">
                        Sign in with Email
                    </h1>
                    <p className="text-purple-300">
                        Enter your email address and we'll send you a
                        verification code
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendOTP();
                    }}
                    className="space-y-4"
                >
                    <div>
                        <Label htmlFor="email" className="text-purple-200">
                            Email address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="bg-gray-900/60 border-purple-600/30 text-purple-100 focus:border-purple-500 placeholder-purple-300/60"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        disabled={isLoading || !email.trim()}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending code...
                            </>
                        ) : (
                            <>
                                Send verification code
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-purple-300 hover:text-purple-200"
                        onClick={resetAuthFlow}
                        disabled={isLoading}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to sign in options
                    </Button>
                </form>
            </div>
            </div>
        );
    }

    if (authMode === "verify") {
        return (
            <div className="h-screen flex items-center justify-center">
            <div className="w-full max-w-md mx-auto bg-black/40 backdrop-blur-sm border border-purple-600/30 rounded-2xl p-8 z-50">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl flex items-center justify-center">
                        <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-purple-100 mb-2">
                        Check your email
                    </h1>
                    <p className="text-purple-300">
                        We sent a verification code to{" "}
                        <span className="font-medium">{email}</span>
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleVerifyOTP();
                    }}
                    className="space-y-4"
                >
                    <div>
                        <Label htmlFor="code" className="text-purple-200">
                            Verification code
                        </Label>
                        <Input
                            id="code"
                            type="text"
                            value={code}
                            onChange={(e) =>
                                setCode(
                                    e.target.value
                                        .replace(/\D/g, "")
                                        .substring(0, 8)
                                )
                            }
                            placeholder="Enter 8-digit code"
                            className="bg-gray-900/60 border-purple-600/30 text-purple-100 focus:border-purple-500 text-center text-lg tracking-widest placeholder-purple-300/60"
                            disabled={isLoading}
                            maxLength={8}
                            autoComplete="one-time-code"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        disabled={isLoading || code.length !== 8}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                Verify code
                                <Check className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>

                    <div className="space-y-2">
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-purple-300 hover:text-purple-200"
                            onClick={() => setAuthMode("email")}
                            disabled={isLoading}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Change email address
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-purple-400 hover:text-purple-300 text-sm"
                            onClick={handleSendOTP}
                            disabled={isLoading}
                        >
                            Didn't receive the code? Send again
                        </Button>
                    </div>
                </form>
            </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex items-center justify-center">
        <div className="w-full max-w-md mx-auto bg-black/40 backdrop-blur-sm border border-purple-600/30 rounded-2xl p-8 z-50">
            <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-purple-100 mb-2">
                    Welcome to 3Tee Chat
                </h1>
                <p className="text-purple-300">
                    Choose how you'd like to sign in
                </p>
            </div>

            <div className="space-y-3">
                {/* OAuth Providers */}
                <Button
                    onClick={() => handleOAuthSignIn("github")}
                    disabled={isLoading}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-600"
                >
                    {loadingProvider === "github" ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Github className="w-5 h-5 mr-2" />
                    )}
                    Continue with GitHub
                </Button>

                <Button
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 border border-gray-300"
                >
                    {loadingProvider === "google" ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Chrome className="w-5 h-5 mr-2" />
                    )}
                    Continue with Google
                </Button>

                {/* Email Authentication */}
                <Button
                    onClick={() => setAuthMode("email")}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full border-purple-600/30 text-purple-200 hover:bg-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-in-out"
                >
                    <Mail className="w-5 h-5 mr-2" />
                    Continue with Email
                </Button>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-purple-600/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-transparent px-4 text-purple-400">
                            or
                        </span>
                    </div>
                </div>

                {/* Anonymous Sign In */}
                <Button
                    onClick={handleAnonymousSignIn}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
                >
                    {loadingProvider === "anonymous" ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <UserX className="w-5 h-5 mr-2" />
                    )}
                    Continue as Guest
                </Button>
            </div>

            <div className="mt-6 text-center">
                <p className="text-xs text-purple-400">
                    By continuing, you agree to our{" "}
                    <a href="#" className="underline hover:text-purple-300">
                        Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="underline hover:text-purple-300">
                        Privacy Policy
                    </a>
                </p>
            </div>
        </div>
        </div>
    );
}
