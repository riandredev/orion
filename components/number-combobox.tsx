import type React from "react"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface NumberComboBoxProps {
  numbers: number[]
  selectedValue: string
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
  placeholder: string
  open: boolean
  className?: string
}

const NumberComboBox: React.FC<NumberComboBoxProps> = ({
  numbers,
  selectedValue,
  onOpenChange,
  onSelect,
  placeholder,
  open,
  className,
}) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-16 justify-between bg-card/5 border-border hover:bg-card/10 text-xl", className)}
        >
          {selectedValue || placeholder}
          <ChevronsUpDown className="h-7 w-7 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[125px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        alignOffset={0}
        forceMount
        collisionPadding={8}
      >
        <div className="max-h-[200px] overflow-y-auto rounded-md bg-popover border border-border shadow-md">
          <div className="py-1">
            {numbers.map((num) => (
              <div
                key={num}
                className={cn(
                  "relative flex cursor-default select-none items-center px-3 py-1.5 text-base hover:bg-accent hover:text-accent-foreground",
                  selectedValue === num.toString() && "bg-accent text-accent-foreground",
                )}
                onClick={() => {
                  onSelect(num.toString())
                  onOpenChange(false)
                }}
              >
                {num}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default NumberComboBox
