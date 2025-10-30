'use client'

import { Palette, Check } from 'lucide-react';
import { Button, Card } from '@gravity-ui/uikit';
import { useProfileStore } from "@/lib/stores/profile-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSetup } from "@/components/setup-provider";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { BucketPaint } from '@gravity-ui/icons';

export function AppearanceSettings() {
  const { openSetupModal, setupData, completeSetup } = useSetup();
  const { theme: currentTheme, setTheme, accentColor, setAccentColor } = useTheme();

  const themes = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'system', name: 'System' },
  ];

  const accentColors = [
    { id: "blue", family: "brand" },
    { id: "orange", family: "orange" },
    { id: "purple", family: "purple" },
    { id: "green", family: "green" },
  ];

  const handleThemeSelect = (id: 'system' | 'light' | 'dark') => {
    // Apply immediately for preview
    setTheme(id);
    // Persist in the same way SetupModal does via completeSetup
    const orgName = setupData?.organizationName || localStorage.getItem('orion-organization-name') || '';
    completeSetup({
      organizationName: orgName,
      theme: id,
      accentColor: accentColor,
    });
  };

  const handleAccentColorSelect = (colorId: string) => {
    // Apply immediately for preview
    setAccentColor(colorId);
    // Persist in the same way SetupModal does via completeSetup
    const orgName = setupData?.organizationName || localStorage.getItem('orion-organization-name') || '';
    completeSetup({
      organizationName: orgName,
      theme: currentTheme,
      accentColor: colorId,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
          {/* Section Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
                <Palette className="text-muted-foreground h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-foreground">Appearance</h2>
                <p className="text-sm text-muted-foreground">
                  Customize the visual theme of your application
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {useProfileStore().getActiveProfile() ? (
              <Card className="p-3 rounded-xl border border-border flex items-center gap-3 min-w-[220px]">
                <Avatar
                  variant="circle"
                  className="h-8 w-8"
                  style={{ background: useProfileStore().getActiveProfile()?.color }}
                >
                  <AvatarFallback
                    variant="circle"
                    className="font-semibold text-black dark:text-background"
                    style={{ background: 'transparent' }}
                  >
                    {useProfileStore().getActiveProfile()?.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Setting theme for</p>
                  <p className="text-sm font-medium">{useProfileStore().getActiveProfile()?.name}</p>
                </div>
              </Card>
            ) : null}
            <Button view="action" onClick={openSetupModal}>Open Setup</Button>
          </div>
        </div>
      </div>
      
      <Card className="p-4 rounded-md border border-border">
      {/* Gravity UI themed cards for theme selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {themes.map((theme) => (
          <div key={theme.id}>
            <button
              type="button"
              onClick={() => handleThemeSelect(theme.id as 'system' | 'light' | 'dark')}
              className={cn(
                // Remove overflow to avoid clipping card borders; align radii with card
                "block w-full cursor-pointer transition-all relative rounded-md p-0"
              )}
            >
              <Card className="p-0 rounded-md" style={currentTheme === theme.id ? { borderColor: "var(--g-color-base-brand)" } : undefined}>
                {/* Preview area similar to SetupModal */}
                <div className="aspect-[4/3] relative">
                  {/* Browser chrome */}
                  <div className="absolute top-2 left-2 right-2 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </div>

                  {/* Dashboard preview */}
                  <div className="absolute inset-0 pt-6 px-2 pb-2">
                    {theme.id === 'system' ? (
                      /* System theme - split design */
                      <div className="w-full h-full rounded-sm flex overflow-hidden">
                        {/* Left side - Dark theme */}
                        <div className="w-1/2 h-full flex bg-slate-900 relative">
                          {/* Sidebar preview - Dark */}
                          <div className="w-2/5 bg-slate-800 p-1 space-y-1">
                            <div className="h-6 rounded-sm bg-blue-500/30" />
                            <div className="h-3 rounded-sm bg-slate-600" />
                            <div className="h-3 rounded-sm bg-slate-600" />
                            <div className="h-2 rounded-sm bg-slate-700 mt-2" />
                            <div className="h-2 rounded-sm bg-slate-700" />
                          </div>
                          {/* Content preview - Dark */}
                          <div className="flex-1 p-1 space-y-1">
                            <div className="h-8 rounded-sm bg-slate-700" />
                            <div className="h-12 rounded-sm bg-slate-600" />
                            <div className="h-4 rounded-sm bg-slate-600" />
                            <div className="h-8 rounded-sm bg-blue-500/30 mt-2" />
                          </div>
                        </div>
                        
                        {/* Divider line */}
                        <div className="w-0.5 bg-gradient-to-b from-slate-400 to-slate-600" />
                        
                        {/* Right side - Light theme */}
                        <div className="w-1/2 h-full flex bg-white relative">
                          {/* Sidebar preview - Light */}
                          <div className="w-2/5 bg-slate-100 p-1 space-y-1">
                            <div className="h-6 rounded-sm bg-blue-500/40" />
                            <div className="h-3 rounded-sm bg-slate-300" />
                            <div className="h-3 rounded-sm bg-slate-300" />
                            <div className="h-2 rounded-sm bg-slate-200 mt-2" />
                            <div className="h-2 rounded-sm bg-slate-200" />
                          </div>
                          {/* Content preview - Light */}
                          <div className="flex-1 p-1 space-y-1">
                            <div className="h-8 rounded-sm bg-slate-200" />
                            <div className="h-12 rounded-sm bg-slate-300" />
                            <div className="h-4 rounded-sm bg-slate-300" />
                            <div className="h-8 rounded-sm bg-blue-500/30 mt-2" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Regular theme preview with enhanced details */
                      <div
                        className={cn(
                          "w-full h-full rounded-sm flex overflow-hidden",
                          theme.id === 'dark' ? "bg-slate-900" : "bg-white",
                        )}
                      >
                        {/* Sidebar preview */}
                        <div className={cn(
                          "w-1/4 p-1 space-y-1",
                          theme.id === 'dark' ? "bg-slate-800" : "bg-slate-100"
                        )}>
                          {/* Navigation items */}
                          <div className={cn(
                            "h-6 rounded-sm",
                            theme.id === 'dark' ? "bg-blue-400/40" : "bg-blue-500/40"
                          )} />
                          <div className={cn(
                            "h-3 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-600" : "bg-slate-300"
                          )} />
                          <div className={cn(
                            "h-3 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-600" : "bg-slate-300"
                          )} />
                          
                          {/* Separator */}
                          <div className={cn(
                            "h-px my-1",
                            theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                          )} />
                          
                          {/* Secondary items */}
                          <div className={cn(
                            "h-2 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                          )} />
                          <div className={cn(
                            "h-2 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                          )} />
                        </div>

                        {/* Content preview */}
                        <div className="flex-1 p-1 space-y-1">
                          {/* Header */}
                          <div className={cn(
                            "h-8 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                          )} />
                          
                          {/* Content blocks */}
                          <div className={cn(
                            "h-12 rounded-sm",
                            theme.id === 'dark' ? "bg-slate-600" : "bg-slate-300"
                          )} />
                          <div className={cn(
                            "h-4 rounded-sm w-3/4",
                            theme.id === 'dark' ? "bg-slate-600" : "bg-slate-300"
                          )} />
                          
                          {/* Action button */}
                          <div className={cn(
                            "h-8 rounded-sm mt-2",
                            theme.id === 'dark' ? "bg-blue-500/30" : "bg-blue-500/30"
                          )} />
                          
                          {/* Additional content */}
                          <div className="flex gap-1 mt-1">
                            <div className={cn(
                              "h-3 rounded-sm flex-1",
                              theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                            )} />
                            <div className={cn(
                              "h-3 rounded-sm flex-1",
                              theme.id === 'dark' ? "bg-slate-700" : "bg-slate-200"
                            )} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              <div className="mt-2 text-left pl-1">
                <span className="text-sm font-medium">{theme.name}</span>
              </div>
            </button>
          </div>
        ))}
      </div>
      </Card>

      {/* Accent Color Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
              <BucketPaint className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground">Accent Color</h2>
              <p className="text-sm text-muted-foreground">
                Choose your preferred accent color
              </p>
            </div>
          </div>
        </div>
        
        <Card className="p-4 rounded-md border border-border">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {accentColors.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => handleAccentColorSelect(color.id)}
              aria-label={`Accent ${color.id}`}
              aria-pressed={accentColor === color.id}
              className={cn(
                "relative w-full h-20 p-0 rounded-lg border-2 transition-all focus:outline-none",
                accentColor === color.id ? "" : "border-border hover:border-muted-foreground/50",
              )}
              style={accentColor === color.id ? { borderColor: "white" } : undefined}
            >
              <div
                className="w-full h-full rounded-md"
                style={{ background: `var(--g-color-private-${color.family}-600-solid)` }}
                title={color.id}
              />
              {accentColor === color.id && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "white" }}
                >
                  <Check className="w-3 h-3 text-[var(--g-color-text-brand)]" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-xs font-medium text-white capitalize bg-black/20 px-2 py-1 rounded">
                {color.id}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}