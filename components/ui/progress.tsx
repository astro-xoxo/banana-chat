import * as React from "react"
// import * as ProgressPrimitive from "@radix-ui/react-progress" // 임시 비활성화

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-surface",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-info transition-all duration-300 ease-out"
        style={{ width: `${value || 0}%` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }
