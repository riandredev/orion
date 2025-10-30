"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Hymn, Verse, LanguageType, HymnType } from '@/app/types/hymn';
import { ScrollArea } from './ui/scroll-area';
import { Check, AlertCircle, Download, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import useVerseStore from '@/lib/store';
import { useScraperStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from './ui/toast';

// Define types for scraped hymns
interface ScrapedHymn {
  number: number;
  title: string;
  verses: string[];
  hasRefrain: boolean;
  refrainText?: string;
  author?: string;
  keySignature?: string;
}

interface ScrapingProgress {
  current: number;
  total: number;
  message: string;
}

interface ScraperProps {
  onComplete?: () => void;
}

export function HymnScraper({ onComplete }: ScraperProps) {
  // Use the global store for state
  const {
    language,
    isLoading,
    isScraping,
    progress,
    statusMessage,
    scrapedHymns,
    error,
    importComplete,
    setLanguage,
    setIsLoading,
    setIsScraping,
    setProgress,
    setStatusMessage,
    setScrapedHymns,
    setError,
    setImportComplete,
    resetScraperState
  } = useScraperStore();
  
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [selectedHymn, setSelectedHymn] = useState<ScrapedHymn | null>(null);
  const { resetAll } = useVerseStore();

  // Reset verse store when component unmounts or when scraping starts
  useEffect(() => {
    resetAll();
    return () => {
      resetAll();
    };
  }, [resetAll]);

  // Set up scraping progress listener only once
  useEffect(() => {
    let unlisten: () => void;
    
    const setupListener = async () => {
      unlisten = await listen<ScrapingProgress>('scraping-progress', (event) => {
        setProgress(Math.floor((event.payload.current / event.payload.total) * 100));
        setStatusMessage(event.payload.message);
        
        // If scraping is complete, update the UI
        if (event.payload.current === event.payload.total || 
            event.payload.message.includes("Scraping stopped") ||
            event.payload.message.includes("Scraping complete")) {
          setIsScraping(false);
          
          // We don't need to fetch results again because they're returned directly 
          // from the initial invoke('scrape_hymns') call in startScraping
        }
      });
    };

    setupListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Function to emit stop-scraping event to backend
  const stopScraping = async () => {
    try {
      await invoke('emit_event', { 
        event: 'stop-scraping',
        windowLabel: 'main',
        payload: {}
      });
      setStatusMessage("Stopping scraper...");
    } catch (err) {
      console.error('Failed to stop scraping:', err);
    }
  };

  const startScraping = async () => {
    setIsLoading(true);
    setIsScraping(true);
    setProgress(0);
    setStatusMessage(`Initializing scraper for ${language} SDA hymnal...`);
    setScrapedHymns([]);
    setError(null);
    setImportComplete(false);
    resetAll(); // Reset verse store when starting scraping

    try {
      // Start the scraping process - fetchOnly: false to initiate actual scraping
      const result = await invoke<ScrapedHymn[]>('scrape_hymns', { language, fetchOnly: false });
      
      // Store the scrape results
      if (Array.isArray(result) && result.length > 0) {
        setScrapedHymns(result);
        setStatusMessage(`Scraping complete! Found ${result.length} hymns.`);
        console.log(`Scraped ${result.length} hymns:`, result);
      } else {
        console.log("No hymns returned from scraper:", result);
        setError("No hymns were found. Please try a different language or check the source website.");
      }
    } catch (err) {
      console.error("Scraping error:", err);
      setError(`Failed to scrape hymns: ${err}`);
    } finally {
      setIsLoading(false);
      setIsScraping(false);
    }
  };

  const importHymns = async () => {
    if (scrapedHymns.length === 0) return;
    
    setIsLoading(true);
    setProgress(0);
    setStatusMessage("Starting import process...");
    
    try {
      for (let i = 0; i < scrapedHymns.length; i++) {
        const hymn = scrapedHymns[i];
        setProgress(Math.floor(((i + 1) / scrapedHymns.length) * 100));
        setStatusMessage(`Importing hymn ${i+1} of ${scrapedHymns.length}: ${hymn.title}`);
        
        // Convert scraped hymn to database format
        const dbHymn: Hymn = {
          id: 0, // This will be assigned by the database
          number: hymn.number,
          title: hymn.title,
          verses_count: hymn.verses.length,
          has_refrain: hymn.hasRefrain,
          refrain_text: hymn.hasRefrain ? hymn.refrainText || "" : "",
          key_signature: hymn.keySignature || null, // Use the scraped key signature if available
          author: hymn.author || "", // Use the scraped author if available
          language: language,
          is_youth_song: false, // Assuming all hymns are standard hymns for simplicity
          hymn_type: getHymnTypeFromLanguage(language)
        };
        
        // Add hymn to database
        try {
          console.log("Adding hymn to database:", dbHymn);
          const hymnId = await invoke('add_hymn', { hymn: dbHymn });
          
          if (!hymnId) {
            console.error("Failed to get hymn ID after insert");
            continue;
          }
          
          console.log("Hymn added with ID:", hymnId);
          
          // Add verses
          for (let j = 0; j < hymn.verses.length; j++) {
            const verse: Verse = {
              id: 0, // This will be assigned by the database
              hymn_id: hymnId as number,
              verse_number: j + 1,
              verse_text: hymn.verses[j]
            };
            
            await invoke('add_verse', { verse });
          }
        } catch (err) {
          console.error(`Failed to import hymn ${hymn.number}:`, err);
          // Continue with next hymn
        }
      }
      
      setProgress(100);
      setStatusMessage("Import complete!");
      setImportComplete(true);
      
      if (onComplete) {
        onComplete();
      }
      
      toast({
        title: `Successfully imported ${scrapedHymns.length} hymns`,
        description: `${scrapedHymns.length} hymns were added to your database.`,
        variant: "success",
        duration: 30000, // 30 seconds
        action: <ToastAction altText="Close">Close</ToastAction>,
      });
    } catch (err) {
      setError(`Import failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine hymn type based on language
  const getHymnTypeFromLanguage = (language: LanguageType): HymnType => {
    switch(language) {
      case 'AFR':
        return 'adventlofliedere';
      case 'ENG':
        return 'adventhymnal';
      case 'SPA':
        return 'adventhymnal'; // Default to regular hymnal for Spanish
      default:
        return 'adventhymnal';
    }
  };

  const previewHymn = (hymn: ScrapedHymn) => {
    setSelectedHymn(hymn);
    setShowPreview(true);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        <Tabs defaultValue="scraper">
          <TabsList className="mb-4">
            <TabsTrigger value="scraper">Scraper</TabsTrigger>
            <TabsTrigger value="preview" disabled={scrapedHymns.length === 0}>Preview ({scrapedHymns.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scraper">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Select
                  disabled={isLoading || isScraping}
                  value={language}
                  onValueChange={(value) => setLanguage(value as LanguageType)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFR">Afrikaans</SelectItem>
                    <SelectItem value="ENG">English</SelectItem>
                  </SelectContent>
                </Select>
                
                {!isScraping ? (
                  <Button 
                    variant="accent"
                    onClick={startScraping} 
                    disabled={isLoading}>
                    {isLoading ? 'Preparing...' : 'Start Scraping'}
                  </Button>
                ) : (
                  <Button 
                    variant="destructive"
                    onClick={stopScraping} 
                    disabled={!isScraping}>
                    Stop Scraping
                  </Button>
                )}
                
                <Button
                  variant={scrapedHymns.length > 0 && !isLoading ? "default" : "outline"}
                  onClick={importHymns}
                  disabled={isLoading || isScraping || scrapedHymns.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Import to Database {scrapedHymns.length > 0 && `(${scrapedHymns.length})`}
                </Button>
              </div>

              {language === "AFR" && (
                <Alert variant="info" className="border-blue-200 dark:border-blue-800 dark:bg-blue-900/20">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Note about Afrikaans Hymns</AlertTitle>
                  <AlertDescription>
                    The scraper will attempt to provide Afrikaans hymn titles for common hymn numbers,
                    but may use English verse texts as placeholders. You can edit the verse texts after importing.
                  </AlertDescription>
                </Alert>
              )}
              
              {isLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {importComplete && (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                  <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <AlertTitle className="text-green-800 dark:text-green-300">Import Completed</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Successfully imported {scrapedHymns.length} hymns to the database.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="preview">
            <div className="space-y-4">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-4">
                  {scrapedHymns.map((hymn) => (
                    <div 
                      key={hymn.number}
                      className="p-4 border rounded-md cursor-pointer hover:bg-muted/50"
                      onClick={() => previewHymn(hymn)}>
                      <div className="font-semibold">
                        {hymn.number}. {hymn.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {hymn.verses.length} verses{hymn.hasRefrain ? ', with refrain' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedHymn?.number}. {selectedHymn?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedHymn?.verses.map((verse, index) => (
              <div key={index} className="space-y-2">
                <div className="font-semibold text-sm">Verse {index + 1}</div>
                <div className="text-sm">{verse}</div>
              </div>
            ))}
            
            {selectedHymn?.hasRefrain && selectedHymn?.refrainText && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">Refrain</div>
                <div className="text-sm">{selectedHymn.refrainText}</div>
              </div>
            )}
            
            {/* Display author if available */}
            {selectedHymn?.author && (
              <div className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium">Author:</span> {selectedHymn.author}
              </div>
            )}
            
            {/* Display key signature if available */}
            {selectedHymn?.keySignature && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Key:</span> {selectedHymn.keySignature}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default HymnScraper;
