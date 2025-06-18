import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Mail, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

interface EmailAuthProps {
    onSuccess: () => void;
}

export function EmailAuth({ onSuccess }: EmailAuthProps) {
    const { signIn } = useAuthActions();
    const [step, setStep] = useState<"email" | "code" | "name">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [fullName, setFullName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setIsLoading(true);
        try {
            await signIn("password", { email, flow: "signUp" });
            setStep("code");
            toast.success("Verification code sent to your email!");
        } catch (error) {
            toast.error("Failed to send verification code");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setIsLoading(true);
        try {
            await signIn("password", { email, code });
            setStep("name");
            toast.success("Email verified successfully!");
        } catch (error) {
            toast.error("Invalid verification code");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) return;

        setIsLoading(true);
        try {
            // Update user profile with full name
            // This would be handled by a mutation
            toast.success("Welcome to 3Tee Chat!");
            onSuccess();
        } catch (error) {
            toast.error("Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                    <Mail className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-purple-100 mb-2">
                    {step === "email" && "Welcome to 3Tee Chat"}
                    {step === "code" && "Check your email"}
                    {step === "name" && "Almost there!"}
                </h1>
                <p className="text-purple-300">
                    {step === "email" && "Enter your email to get started"}
                    {step === "code" &&
                        "Enter the verification code we sent you"}
                    {step === "name" &&
                        "Tell us your name to personalize your experience"}
                </p>
            </div>

            {step === "email" && (
                <form onSubmit={handleSendCode} className="space-y-4">
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
                            className="bg-gray-900/60 border-purple-600/30 text-purple-100 focus:border-purple-500"
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        disabled={isLoading}
                    >
                        {isLoading ? "Sending..." : "Send verification code"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </form>
            )}

            {step === "code" && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div>
                        <Label htmlFor="code" className="text-purple-200">
                            Verification code
                        </Label>
                        <Input
                            id="code"
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Enter 6-digit code"
                            className="bg-gray-900/60 border-purple-600/30 text-purple-100 focus:border-purple-500 text-center text-lg tracking-widest"
                            maxLength={6}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        disabled={isLoading}
                    >
                        {isLoading ? "Verifying..." : "Verify code"}
                        <Check className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-purple-300 hover:text-purple-200"
                        onClick={() => setStep("email")}
                    >
                        Back to email
                    </Button>
                </form>
            )}

            {step === "name" && (
                <form onSubmit={handleSetName} className="space-y-4">
                    <div>
                        <Label htmlFor="fullName" className="text-purple-200">
                            Full name
                        </Label>
                        <Input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                            className="bg-gray-900/60 border-purple-600/30 text-purple-100 focus:border-purple-500"
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        disabled={isLoading}
                    >
                        {isLoading ? "Setting up..." : "Complete setup"}
                        <Check className="w-4 h-4 ml-2" />
                    </Button>
                </form>
            )}

            <div className="mt-6 text-center">
                <p className="text-xs text-purple-400">
                    By continuing, you agree to our Terms of Service and Privacy
                    Policy
                </p>
            </div>
        </div>
    );
}
