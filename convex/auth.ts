import { convexAuth } from "@convex-dev/auth/server";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { ResendOTP } from "./emailAuth";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";

export const { auth, signIn, signOut, store } = convexAuth({
    providers: [
        GitHub,
        Google,
        Resend({
            from: process.env.AUTH_EMAIL ?? "3Tee Chat <onboarding@3tee.chat>",
        }),
        ResendOTP,
        Anonymous,
    ],
});
