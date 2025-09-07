import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // LobeHub UI 스타일: 깔끔한 디자인, 둥근 모서리, 미묘한 그림자
          "flex min-h-input w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm shadow-sm ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
