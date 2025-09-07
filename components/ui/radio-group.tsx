import * as React from "react"
// import * as RadioGroupPrimitive from "@radix-ui/react-radio-group" // 임시 비활성화
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

// 임시 간단한 대체 컴포넌트
interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn("grid gap-2", className)}
        {...props}
        ref={ref}
      />
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="radio"
        ref={ref}
        className={cn(
          "h-4 w-4 rounded-full border border-gray-300",
          className
        )}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
