'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addDurationToTime, formatDuration, parseNaturalDuration } from '@/app/utils/time'

interface AddSelectionDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string, time: string, runtime: string) => void
}

export function AddSelectionDialog({ isOpen, onClose, onAdd }: AddSelectionDialogProps) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [formattedDuration, setFormattedDuration] = useState('')

  useEffect(() => {
    if (startTime && duration) {
      const endTimeValue = addDurationToTime(startTime, duration);
      setEndTime(endTimeValue);
    }
  }, [startTime, duration]);

  useEffect(() => {
    if (duration) {
      const { hours, minutes, seconds } = parseNaturalDuration(duration);
      setFormattedDuration(formatDuration(hours, minutes, seconds));
    }
  }, [duration]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startTime || !duration) return;

    const time = `${startTime} - ${endTime}`
    onAdd(name, time, formattedDuration || '0h 00m 00s')
    setName('')
    setDuration('')
    setStartTime('')
    setEndTime('')
    setFormattedDuration('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed top-[35%] left-1/2 -translate-x-1/2 sm:max-w-[675px] max-h-[70vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Create manual time slot entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Time slot name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-muted-foreground/25"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Input
                placeholder="1h 00m 00s"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-background border-muted-foreground/25"
                required
              />
              <p className="text-sm text-muted-foreground">You can type natural language here i.e. 2h 30m</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-background border-muted-foreground/25"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="time"
                  value={endTime}
                  className="bg-background border-muted-foreground/25"
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="bg-muted-foreground/10 hover:bg-muted-foreground/20"
            >
              Cancel
            </Button>
            <Button type="submit">
              Create Time Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
