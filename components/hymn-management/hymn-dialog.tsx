import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { invoke } from '@tauri-apps/api/core';
import { Hymn, KeySignature } from '@/app/types/hymn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HymnDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onHymnAdded?: () => void;
  selectedHymn?: Hymn | null;  // Add this prop
}

const languages = [
  { value: "AFR", label: "Afrikaans" },
  { value: "ENG", label: "English" },
];

const keySignatures = [
  "C Major", "G Major", "D Major", "A Major", "E Major", "B Major",
  "F# Major", "Gb Major", "Db Major", "Ab Major", "Eb Major", "Bb Major", "F Major",
  "A Minor", "E Minor", "B Minor", "F# Minor", "C# Minor", "G# Minor",
  "D# Minor", "Bb Minor", "F Minor", "C Minor", "G Minor", "D Minor"
] as const;

interface VerseData {
  verse_number: number;
  verse_text: string;
}

const getDefaultHymnType = (language: string, isYouthSong: boolean) => {
  switch (language) {
    case 'AFR':
      return isYouthSong ? "adventjeugliede" : "adventlofliedere";
    case 'ENG':
      return isYouthSong ? "adventyouthsongs" : "adventhymnal";
    default:
      return "adventhymnal";
  }
};

export function HymnDialog({ isOpen, onOpenChange, onHymnAdded, selectedHymn }: HymnDialogProps) {
  const [formData, setFormData] = useState<Partial<Hymn>>({
    language: "AFR",
    has_refrain: false,
    is_youth_song: false,
    key_signature: null,
    hymn_type: "adventlofliedere"  // Add default hymn_type
  });
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Add effect to update hymn_type when language or is_youth_song changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      hymn_type: getDefaultHymnType(prev.language || 'AFR', prev.is_youth_song || false)
    }));
  }, [formData.language, formData.is_youth_song]);

  // Update verses when verses_count changes
  useEffect(() => {
    if (formData.verses_count) {
      const newVerses = Array.from({ length: formData.verses_count }, (_, i) => ({
        verse_number: i + 1,
        verse_text: verses[i]?.verse_text || ''
      }));
      setVerses(newVerses);
    }
  }, [formData.verses_count]);

  // Replace the useEffect for selectedHymn
  useEffect(() => {
    console.log('Selected hymn changed:', selectedHymn);
    if (selectedHymn) {
      // Initialize form data with all fields from selected hymn
      setFormData({
        id: selectedHymn.id,
        number: selectedHymn.number,
        title: selectedHymn.title,
        verses_count: selectedHymn.verses_count,
        has_refrain: selectedHymn.has_refrain,
        refrain_text: selectedHymn.refrain_text,
        key_signature: selectedHymn.key_signature,
        author: selectedHymn.author,
        language: selectedHymn.language,
        is_youth_song: selectedHymn.is_youth_song,
        hymn_type: selectedHymn.hymn_type
      });

      const loadVerses = async () => {
        try {
          console.log('Loading verses for hymn:', selectedHymn.id); // Debug log
          const verseData = await invoke<{ verse_number: number; verse_text: string; }[]>(
            'get_verses_for_hymn',
            { hymnId: selectedHymn.id } // Changed from hymn_id to hymnId to match Rust command
          );
          console.log('Loaded verses:', verseData);
          setVerses(verseData);
        } catch (error) {
          console.error('Failed to load verses:', error);
        }
      };
      loadVerses();
    } else {
      // Reset form when no hymn is selected
      setFormData({
        language: "AFR",
        has_refrain: false,
        is_youth_song: false,
        key_signature: null,
        hymn_type: "adventlofliedere"
      });
      setVerses([]);
    }
  }, [selectedHymn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Make sure all required fields are present
      if (!formData.number || !formData.title || !formData.verses_count || !formData.language || !formData.hymn_type) {
        console.error('Missing required fields');
        return;
      }

      const hymn: Hymn = {
        id: selectedHymn?.id, // Include the id if editing
        number: Number(formData.number),
        title: formData.title!,
        verses_count: Number(formData.verses_count),
        has_refrain: formData.has_refrain || false,
        refrain_text: formData.refrain_text || undefined,
        key_signature: formData.key_signature || null,
        author: formData.author || undefined,
        language: formData.language!,
        is_youth_song: formData.is_youth_song || false,
        hymn_type: formData.hymn_type!
      };

      if (selectedHymn) {
        // Update existing hymn
        await invoke('update_hymn', { hymn });

        // First delete all existing verses for this hymn
        await invoke('delete_verses_for_hymn', { hymnId: selectedHymn.id }); // Changed from hymn_id to hymnId

        // Then add the updated verses
        for (const verse of verses) {
          const verseData = {
            hymn_id: selectedHymn.id,
            verse_number: verse.verse_number,
            verse_text: verse.verse_text.trim()
          };
          await invoke('add_verse', { verse: verseData });
        }
      } else {
        // Add new hymn
        const hymn_id = await invoke<number>('add_hymn', { hymn });
        // Save verses for new hymn
        for (const verse of verses) {
          if (verse.verse_text.trim()) {
            const verseData = {
              hymn_id,
              verse_number: verse.verse_number,
              verse_text: verse.verse_text.trim()
            };
            await invoke('add_verse', { verse: verseData });
          }
        }
      }

      // Reset and close
      setFormData({
        language: "AFR",
        has_refrain: false,
        is_youth_song: false,
        key_signature: null,
        hymn_type: "adventlofliedere"
      });
      setVerses([]);
      onHymnAdded?.();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Failed to save hymn:', error);
      alert('Failed to save hymn. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-[675px] max-h-[85vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">
            {selectedHymn ? 'Edit Hymn' : 'Add New Hymn'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger
                value="verses"
                disabled={!formData.verses_count}
              >
                Verses & Refrain
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-0">
              <div className="space-y-4 min-h-fit">
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hymn Number</Label>
                      <Input
                        type="number"
                        value={formData.number || ''}
                        onChange={e => setFormData(prev => ({ ...prev, number: parseInt(e.target.value) }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={formData.language}
                        onValueChange={value => setFormData(prev => ({ ...prev, language: value as "AFR" | "ENG" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={formData.title || ''}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Author</Label>
                    <Input
                      value={formData.author || ''}
                      onChange={e => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Number of Verses</Label>
                      <Input
                        type="number"
                        value={formData.verses_count || ''}
                        onChange={e => setFormData(prev => ({ ...prev, verses_count: parseInt(e.target.value) }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Key Signature</Label>
                      <Select
                        value={formData.key_signature || "none"}
                        onValueChange={value => setFormData(prev => ({
                          ...prev,
                          key_signature: value === "none" ? null : (value as KeySignature)
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select key" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Key</SelectItem>
                          {keySignatures.map(key => (
                            <SelectItem key={key} value={key}>
                              {key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="has-refrain"
                        checked={formData.has_refrain}
                        onCheckedChange={checked => setFormData(prev => ({ ...prev, has_refrain: checked }))}
                      />
                      <Label htmlFor="has-refrain">Has Refrain</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="youth-song"
                        checked={formData.is_youth_song}
                        onCheckedChange={checked => setFormData(prev => ({ ...prev, is_youth_song: checked }))}
                      />
                      <Label htmlFor="youth-song">Youth Song</Label>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="verses" className="mt-0">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {verses.map((verse, index) => (
                    <div
                      key={verse.verse_number}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Verse {verse.verse_number}</Label>
                        <span className="text-xs text-muted-foreground">
                          {verse.verse_text.length} characters
                        </span>
                      </div>
                      <Textarea
                        value={verse.verse_text}
                        onChange={e => {
                          const newVerses = [...verses];
                          newVerses[index].verse_text = e.target.value;
                          setVerses(newVerses);
                        }}
                        className="min-h-[120px] resize-none"
                        placeholder={`Enter verse ${verse.verse_number} text...`}
                      />
                    </div>
                  ))}

                  {formData.has_refrain && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Refrain</Label>
                        <span className="text-xs text-muted-foreground">
                          {formData.refrain_text?.length || 0} characters
                        </span>
                      </div>
                      <Textarea
                        value={formData.refrain_text || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          refrain_text: e.target.value
                        }))}
                        className="min-h-[120px] resize-none"
                        placeholder="Enter refrain text..."
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {selectedHymn ? 'Save Changes' : 'Add Hymn'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
