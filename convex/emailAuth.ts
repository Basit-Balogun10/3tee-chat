import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTP = Email({
    id: "resend-otp",
    apiKey: process.env.AUTH_RESEND_KEY,
    maxAge: 60 * 20,
    async generateVerificationToken() {
        return generateRandomString(8, alphabet("0-9"));
    },
    async sendVerificationRequest({
        identifier: email,
        provider,
        token,
        expires,
    }) {
        const resend = new ResendAPI(provider.apiKey);
        const { error } = await resend.emails.send({
            from: process.env.AUTH_EMAIL ?? "3Tee Chat <onboarding@3tee.chat>",
            to: [email],
            subject: `Sign in to 3Tee Chat`,
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #9333ea4d, #db27771a); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">3Tee Chat</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: #374151;">Your verification code</h2>
          <p style="color: #6b7280;">Enter this code to complete your sign-in:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #374151;">${token}</span>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">
            This code will expire in ${Math.floor((+expires - Date.now()) / (60 * 1000))} minutes. If you didn't request this code, you can safely ignore it.
          </p>
        </div>
      </div>`,
        });

        if (error) {
            throw new Error(JSON.stringify(error));
        }
    },
});
