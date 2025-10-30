'use client'

import { FileUpload } from '@nine-thirty-five/material-icons-react/rounded';
import { CardContent } from "@/components/ui/card";
import { Button, Card } from '@gravity-ui/uikit';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Image from 'next/image';

export function BibleSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-medium text-foreground mb-2">Bible Display Background</h2>
        <p className="text-base text-muted-foreground mb-5">Customize the background image for Bible verse displays.</p>
        <Card className="bg-card-background border-0">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-start gap-6">
              <div className="relative w-[300px] h-[169px] rounded-md overflow-hidden border border-border">
                <Image
                  src="/bible-image.jpg"
                  alt="Current Bible background"
                  width={300}
                  height={169}
                  className="object-cover"
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Current Background</h3>
                <Button
                  view="outlined"
                  onClick={async () => {
                    const selected = await open({
                      directory: false,
                      multiple: false,
                      filters: [{
                        name: 'Images',
                        extensions: ['jpg', 'jpeg', 'png', 'webp']
                      }]
                    });
                    if (selected) {
                      await invoke('set_bible_background', { path: selected });
                    }
                  }}
                  startIcon={<FileUpload className="h-5 w-5" />}
                >
                  Change Background
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}