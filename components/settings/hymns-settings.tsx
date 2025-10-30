'use client'

import { Database } from 'lucide-react';
import { FileUpload } from '@nine-thirty-five/material-icons-react/rounded';
import { CardContent } from "@/components/ui/card";
import { Button, Card, Icon } from '@gravity-ui/uikit';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Image from 'next/image';
import { HymnScraper } from '../hymn-scraper';
import { ArrowShapeUpFromLine, Picture } from '@gravity-ui/icons';

export function HymnsSettings() {
  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-xl font-medium text-foreground mb-2">Hymn Scraper</h2>
        <p className="text-base text-muted-foreground mb-5">Import Seventh-day Adventist hymns in English and Afrikaans.</p>
        <HymnScraper onComplete={() => {
          // Refresh the hymn list after import is complete
          console.log("Hymn import completed");
        }} />
      </div>

      <div>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
              <Picture className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-foreground">Hymn Display Background</h2>
              <p className="text-sm text-muted-foreground">
                Customize the background image for hymn displays
              </p>
            </div>
          </div>
        </div>
        <Card className="bg-card-background border-0">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-start gap-6">
              <div className="relative w-[300px] h-[169px] rounded-md overflow-hidden border border-border">
                <Image
                  src="/hymn-image.jpg"
                  alt="Current hymn background"
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
                      await invoke('set_hymn_background', { path: selected });
                    }
                  }}
                >
                  <Icon data={ArrowShapeUpFromLine} size={16} />
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