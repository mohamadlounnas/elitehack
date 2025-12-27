import { Toaster, TooltipProvider } from "@medusajs/ui";
import type { PropsWithChildren } from "react";
import { ThemeProvider } from "./theme-provider/theme-provider";

export const Providers = ({ children }: PropsWithChildren) => {
  return (
    <TooltipProvider>
      <ThemeProvider>
        {children}
        <Toaster />
      </ThemeProvider>
    </TooltipProvider>
  );
};
