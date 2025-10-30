"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button, Icon } from "@gravity-ui/uikit"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, RotateCcw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme-context"
import { TextInput } from "@gravity-ui/uikit"
import { ArrowRotateLeft, Xmark } from "@gravity-ui/icons"

interface SetupData {
  organizationName: string
  theme: "system" | "light" | "dark"
  accentColor: string
}

interface SetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SetupData) => void
}

const themes = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
]

const accentColors = [
  { id: "blue", family: "brand" },
  { id: "orange", family: "orange" },
  { id: "pink", family: "purple" },
  { id: "green", family: "green" },
]

export function SetupModal({ isOpen, onClose, onSave }: SetupModalProps) {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme()
  
  const [settings, setSettings] = useState<SetupData>(() => ({
    organizationName: typeof window !== 'undefined' ? localStorage.getItem('orion-organization-name') || "" : "",
    theme: theme,
    accentColor: accentColor,
  }))

  const updateSetting = <K extends keyof SetupData>(field: K, value: SetupData[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    
    // Apply changes immediately for live preview
    if (field === 'theme') {
      setTheme(value as "system" | "light" | "dark")
    }
    if (field === 'accentColor') {
      setAccentColor(value as string)
    }
  }

  const handleSave = () => {
    onSave(settings)
    onClose()
  }

  const handleReset = () => {
    setSettings({
      organizationName: "",
      theme: "system",
      accentColor: "blue",
    })
    setTheme("system")
    setAccentColor("blue")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden p-0 bg-background border shadow-lg">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold">Setup</DialogTitle>
            <Button variant="ghost" onClick={onClose} className="h-8 w-8 rounded-sm">
              <Icon data={Xmark} className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Organization Name Section */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">Organization Name</Label>
              <p className="text-sm text-muted-foreground">Enter your organization or church name</p>
            </div>
            <TextInput
              size="xl"
              type="text"
              value={settings.organizationName}
              onChange={(e) => updateSetting("organizationName", e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          {/* Interface Theme Section */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">Interface theme</Label>
              <p className="text-sm text-muted-foreground">Customise you application theme</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={cn(
                    "block w-full cursor-pointer transition-all relative overflow-hidden rounded-md border-2 p-0",
                    settings.theme === theme.id ? "" : "border-border hover:border-muted-foreground/50",
                  )}
                  style={settings.theme === theme.id ? { borderColor: "var(--g-color-base-brand)" } : undefined}
                  onClick={() => updateSetting("theme", theme.id as SetupData["theme"])}
                >
                  <div className="p-0">
                    {/* Theme Preview */}
                    <div className="aspect-[4/3] relative">
                      {/* Browser chrome */}
                      <div className="absolute top-2 left-2 right-2 flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      </div>

                      {/* Dashboard preview */}
                      <div className="absolute inset-0 pt-6 px-2 pb-2">
                        <div
                          className={cn(
                            "w-full h-full rounded-sm flex",
                            theme.id === "dark"
                              ? "bg-slate-900"
                              : theme.id === "light"
                                ? "bg-white"
                                : "bg-gradient-to-r from-white to-slate-900",
                          )}
                        >
                          {/* Sidebar */}
                          <div
                            className={cn(
                              "w-1/3 p-2 space-y-1",
                              theme.id === "dark"
                                ? "bg-slate-800"
                                : theme.id === "light"
                                  ? "bg-slate-100"
                                  : "bg-slate-100",
                            )}
                          >
                            <div className={cn("h-1 rounded", theme.id === "dark" ? "bg-slate-700" : "bg-slate-300")} />
                            <div className={cn("h-1 rounded", theme.id === "dark" ? "bg-slate-700" : "bg-slate-300")} />
                            <div className={cn("h-1 rounded", theme.id === "dark" ? "bg-slate-700" : "bg-slate-300")} />
                          </div>

                          {/* Main content */}
                          <div className="flex-1 p-2 space-y-1.5">
                            <div
                              className={cn(
                                "text-[8px] font-medium",
                                theme.id === "dark"
                                  ? "text-white"
                                  : theme.id === "light"
                                    ? "text-slate-900"
                                    : "text-slate-900",
                              )}
                            >
                              My dashboard
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <div
                                className={cn("h-6 rounded", theme.id === "dark" ? "bg-slate-800" : "bg-slate-200")}
                              />
                              <div
                                className={cn("h-6 rounded", theme.id === "dark" ? "bg-slate-800" : "bg-slate-200")}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Checkmark */}
                      {settings.theme === theme.id && (
                        <div
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "var(--g-color-base-brand)" }}
                        >
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Theme name */}
                    <div className="px-3 py-2 text-center">
                      <p className="text-sm font-medium">{theme.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Section */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">Accent Color</Label>
              <p className="text-sm text-muted-foreground">Choose your preferred accent color</p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {accentColors.map((color) => (
                <Button
                  key={color.id}
                  onClick={() => updateSetting("accentColor", color.id)}
                  variant="ghost"
                  className={cn(
                    "relative w-full h-12 p-0 rounded-lg border-2 transition-all",
                    settings.accentColor === color.id ? "" : "border-border hover:border-muted-foreground/50",
                  )}
                  style={settings.accentColor === color.id ? { borderColor: "var(--g-color-base-brand)" } : undefined}
                >
                  <div
                    className="w-full h-full rounded-md"
                    style={{ background: `var(--g-color-private-${color.family}-600-solid)` }}
                  />
                  {settings.accentColor === color.id && (
                    <div
                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "var(--g-color-base-brand)" }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </Button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <Button
            size="m"
            view="flat"
            onClick={handleReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Icon data={ArrowRotateLeft} className="w-4 h-4" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button size="m" view="outlined" onClick={onClose}>
              Cancel
            </Button>
            <Button size="m" view="action" onClick={handleSave}>Save preferences</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
