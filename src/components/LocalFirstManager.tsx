import React, { createContext, useContext, ReactNode } from "react";
import { useLocalFirst, UseLocalFirstReturn } from "../hooks/useLocalFirst";

// Create context for local-first functionality
const LocalFirstContext = createContext<UseLocalFirstReturn | null>(null);

interface LocalFirstManagerProps {
    children: ReactNode;
}

export function LocalFirstManager({ children }: LocalFirstManagerProps) {
    const localFirstData = useLocalFirst();

    return (
        <LocalFirstContext.Provider value={localFirstData}>
            {children}
        </LocalFirstContext.Provider>
    );
}

// Hook to use local-first context
export function useLocalFirstContext(): UseLocalFirstReturn {
    const context = useContext(LocalFirstContext);
    if (!context) {
        throw new Error("useLocalFirstContext must be used within a LocalFirstManager");
    }
    return context;
}
