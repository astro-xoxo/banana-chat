import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // LobeHub UI 스타일: 매우 둥근 모서리, 미묘한 그림자, 부드러운 전환
  "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default: LobeHub UI의 진한 텍스트색 버튼
        default: "bg-foreground text-inverse hover:bg-foreground/90 shadow-sm hover:shadow-hover",
        
        // Destructive: 에러/삭제 액션
        destructive: "bg-error text-inverse hover:bg-error/90 shadow-sm hover:shadow-hover",
        
        // Outline: 테두리 버튼
        outline: "border border-border bg-background text-foreground hover:bg-surface hover:text-foreground shadow-sm hover:shadow-hover",
        
        // Secondary: 회색 배경 버튼
        secondary: "bg-surface text-foreground hover:bg-interactive-hover shadow-sm hover:shadow-hover",
        
        // Ghost: 투명 배경 버튼
        ghost: "text-foreground hover:bg-surface transition-colors duration-150",
        
        // Link: 링크 스타일
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        
        // Success: 성공 액션
        success: "bg-success text-inverse hover:bg-success/90 shadow-sm hover:shadow-hover",
        
        // Warning: 경고 액션
        warning: "bg-warning text-inverse hover:bg-warning/90 shadow-sm hover:shadow-hover",
      },
      size: {
        // LobeHub UI 스타일 크기
        sm: "min-h-button-sm px-4 py-2 text-sm rounded-xl",
        default: "min-h-button px-6 py-3 text-sm rounded-2xl",
        lg: "min-h-button-lg px-8 py-4 text-base rounded-2xl",
        xl: "min-h-16 px-10 py-5 text-lg rounded-3xl",
        
        // 아이콘 버튼
        icon: "min-h-button min-w-button p-3 rounded-2xl",
        "icon-sm": "min-h-button-sm min-w-button-sm p-2 rounded-xl",  
        "icon-lg": "min-h-button-lg min-w-button-lg p-4 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
