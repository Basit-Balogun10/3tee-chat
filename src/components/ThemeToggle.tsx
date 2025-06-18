import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTheme } from "./ThemeProvider";
import { useEffect } from "react";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();

    // Listen for theme toggle event from keyboard shortcuts
    useEffect(() => {
        const handleToggleTheme = () => {
            // Cycle through themes: light -> dark -> system -> light
            if (theme === "light") {
                setTheme("dark");
            } else if (theme === "dark") {
                setTheme("system");
            } else {
                setTheme("light");
            }
        };

        document.addEventListener("toggleTheme", handleToggleTheme);
        return () =>
            document.removeEventListener("toggleTheme", handleToggleTheme);
    }, [setTheme, theme]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors text-purple-200"
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
