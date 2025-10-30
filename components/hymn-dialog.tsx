import React, { useEffect, useState } from 'react';  // Add useState import
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hymn } from "@/app/types/hymn";
import { useForm } from "react-hook-form";
import { Switch } from "@/components/ui/switch";

// Add these at the top of the file
const languages = [
  { value: "AFR", label: "Afrikaans" },
  { value: "ENG", label: "English" },
  { value: "SPA", label: "Spanish" }
];

const getHymnTypesByLanguage = (language: string) => {
  switch (language) {
    case 'AFR':
      return [
        { value: "adventlofliedere", label: "Advent Lofliedere" },
        { value: "adventjeugliede", label: "Advent Jeug Liede" }
      ];
    case 'ENG':
      return [
        { value: "adventhymnal", label: "Advent Hymnal" },
        { value: "adventyouthsongs", label: "Advent Youth Songs" }
      ];
    default:
      return [
        { value: "adventhymnal", label: "Advent Hymnal" }
      ];
  }
};

interface HymnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (hymn: Hymn) => void;
  hymn?: Hymn;
}

export default function HymnDialog({ open, onOpenChange, onSave, hymn }: HymnDialogProps) {
  const form = useForm<Hymn>({
    defaultValues: hymn || {
      number: 0,
      title: "",
      verses_count: 0,
      has_refrain: false,
      language: "AFR",
      is_youth_song: false,
      hymn_type: "adventlofliedere"
    }
  });

  const [hymnTypes, setHymnTypes] = useState(getHymnTypesByLanguage(form.watch("language")));

  useEffect(() => {
    const selectedLanguage = form.watch("language");
    setHymnTypes(getHymnTypesByLanguage(selectedLanguage));

    // Update hymn type when language changes
    const newHymnTypes = getHymnTypesByLanguage(selectedLanguage);
    form.setValue("hymn_type", newHymnTypes[0].value);
  }, [form.watch("language")]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hymn ? "Edit Hymn" : "Add New Hymn"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            {/* ...existing form fields... */}

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
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
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hymn_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hymn Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select hymn type" />
                    </SelectTrigger>
                    <SelectContent>
                      {hymnTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_youth_song"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormLabel>Youth Song</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {hymn ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
