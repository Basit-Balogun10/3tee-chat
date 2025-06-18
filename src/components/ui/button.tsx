import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]": variant === "default",
            "bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl": variant === "destructive",
            "border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-100 backdrop-blur-sm": variant === "outline",
            "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30 backdrop-blur-sm": variant === "secondary",
            "hover:bg-purple-500/20 text-purple-200 hover:text-purple-100": variant === "ghost",
            "text-purple-400 underline-offset-4 hover:underline hover:text-purple-300": variant === "link",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
