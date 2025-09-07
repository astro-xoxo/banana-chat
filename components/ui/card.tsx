import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // LobeHub UI 스타일: 매우 둥근 모서리, 미묘한 그림자, 깔끔한 배경
      "rounded-3xl border border-border bg-surface text-foreground shadow-sm transition-all duration-200",
      interactive && "hover:shadow-hover cursor-pointer",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // LobeHub UI 스타일: 적절한 패딩과 간격
      "flex flex-col space-y-2 p-6",
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      // LobeHub UI 스타일: 깔끔한 타이포그래피
      "text-lg font-semibold leading-tight text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      // LobeHub UI 스타일: 적절한 텍스트 크기와 라인 높이
      "text-sm text-muted leading-normal",
      className
    )}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      // LobeHub UI 스타일: 적절한 패딩
      "p-6 pt-0", 
      className
    )} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // LobeHub UI 스타일: 적절한 패딩과 간격
      "flex items-center gap-3 p-6 pt-0", 
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
