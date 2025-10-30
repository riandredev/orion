import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboBoxProps {
  items: { value: string; label: string }[];
  selectedValue: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  open: boolean;
  className?: string;
}

export default function ComboBox({
  items,
  selectedValue,
  onOpenChange,
  onSelect,
  placeholder,
  icon,
  open,
  className,
}: ComboBoxProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-16 p-0 justify-between bg-card/5 border-border hover:bg-card/10 overflow-hidden",
            !open && "cursor-default hover:bg-card/5", // Disable hover effect when not openable
            className
          )}
        >
          <div className="flex items-center h-full">
            <div className="h-full w-16 flex items-center justify-center bg-card-background border-r border-border text-muted-foreground">
              {icon}
            </div>
            <div className="px-4">
              <span className="text-foreground text-xl">
                {items.find((item) => item.value === selectedValue)?.label || placeholder}
              </span>
            </div>
          </div>
          <div className="px-4">
            <ChevronDown className="h-6 w-6 shrink-0 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      {/* Only render PopoverContent if we allow opening */}
      {onOpenChange !== (() => {}) && (
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 bg-card text-card-foreground"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          align="start"
          sideOffset={0}
        >
          <div className="max-h-[300px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.value}
                className={cn(
                  "flex items-center px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  selectedValue === item.value && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  onSelect(item.value);
                  onOpenChange(false);
                }}
              >
                <span className="text-lg">{item.label}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
