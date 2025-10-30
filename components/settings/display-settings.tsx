'use client'

import { useState, useEffect } from 'react';
import { Monitor, Info, Command } from 'lucide-react';
import { CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from '@gravity-ui/uikit';
import { invoke } from '@tauri-apps/api/core';
import { DisplayGrid } from "../display-grid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Display, Wrench } from '@gravity-ui/icons';

interface Display {
  id: string;
  name: string;
}

export function DisplaySettings() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([]);

  useEffect(() => {
    const fetchDisplays = async () => {
      try {
        const displayList = await invoke<Display[]>('get_displays');
        setDisplays(displayList);
        // After we know the displays, load saved selection and map indices to ids
        try {
          const selectedIdx = await invoke<number[]>('get_selected_displays');
          const ids = selectedIdx
            .map((i) => displayList[i]?.id)
            .filter((id): id is string => Boolean(id));
          if (ids.length > 0) setSelectedDisplays(ids);
        } catch (e) {
          // ignore; backend will create defaults
        }
      } catch (error) {
        console.error('Failed to fetch displays:', error);
      }
    };

    fetchDisplays();
  }, []);

  const handleDisplayClick = (displayId: string, index: number, isCheckbox = false) => {
    if (isCheckbox) {
      setSelectedDisplays(prev =>
        prev.includes(displayId)
          ? prev.filter(id => id !== displayId)
          : [...prev, displayId]
      );
    } else {
      setSelectedDisplays(prev =>
        prev.includes(displayId)
          ? prev.filter(id => id !== displayId)
          : [...prev, displayId]
      );
    }
  };

  // Persist selection whenever it changes (and we know displays)
  useEffect(() => {
    if (displays.length === 0) return;
    // Map selected ids back to indices for backend
    const indices = selectedDisplays
      .map((id) => displays.findIndex((d) => d.id === id))
      .filter((i) => i >= 0);
    invoke('save_selected_displays', { displays: indices }).catch(() => {});
  }, [selectedDisplays, displays]);

  return (
    <div className="space-y-8">
      <div>
        {/* Section Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
              <Display className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground">Projection Display</h2>
              <p className="text-sm text-muted-foreground">
                Select which display to show the presentation window
              </p>
            </div>
          </div>
        </div>
        <Card className="bg-card-background border-0">
          <CardContent className="p-8 space-y-4">
            <DisplayGrid
              displays={displays}
              selectedDisplays={selectedDisplays}
              onDisplayClick={handleDisplayClick}
            />
            <div className="mt-6">
              <Alert variant="info" className="mb-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center">
                    Hold <kbd className="px-2 py-1.5 mx-2 text-xs font-sans font-semibold rounded-md border inline-flex items-center gap-1 bg-white/80 dark:bg-blue-800">Ctrl</kbd> (Windows & Linux) or <kbd className="px-2 mx-2 py-1.5 font-sans font-semibold rounded-md border inline-flex items-center gap-1 bg-white/80 dark:bg-blue-800"><Command className="h-4 w-4" /></kbd> (Mac) while clicking to select multiple displays
                  </AlertDescription>
                </div>
              </Alert>
              <h3 className="text-base font-medium">Output Display</h3>
              <p className="text-sm text-muted-foreground mb-4">Choose where to show the presentation</p>
              <div className="space-y-2">
                {displays.map((display, index) => (
                  <div key={display.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={display.id}
                      checked={selectedDisplays.includes(display.id)}
                      onCheckedChange={() => handleDisplayClick(display.id, index, true)}
                    />
                    <Label
                      htmlFor={display.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {display.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        {/* Section Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
              <Wrench className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground">Advanced Display Settings</h2>
              <p className="text-sm text-muted-foreground">
                Configure how content is displayed on the projection screen
              </p>
            </div>
          </div>
        </div>
        <Card className="bg-card-background border-0">
          <CardContent className="p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-lg">Auto-advance Verses</Label>
                <p className="text-sm text-muted-foreground">Automatically move to next verse</p>
              </div>
              <Switch shape="rect" className="h-6 w-12" defaultChecked />
            </div>
            <Separator className="bg-foreground/10" />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-lg">Disable Verse Switches</Label>
                <p className="text-sm text-muted-foreground">Removes the ability to disable verses</p>
              </div>
              <Switch shape="rect" className="h-6 w-12" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}