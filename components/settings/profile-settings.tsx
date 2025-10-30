'use client'

import { useState } from 'react'
import { Group } from '@nine-thirty-five/material-icons-react/rounded'
import { PencilToSquare, PersonPlus, TrashBin, Plus } from '@gravity-ui/icons'
import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button, Icon, Card, TextInput } from '@gravity-ui/uikit'
import { Input } from "@/components/ui/input"
import { Moon, Sun, Monitor } from 'lucide-react'
import { useProfileStore, generatePastelColor, generateId, Profile } from "@/lib/stores/profile-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function ProfileSettings() {
  const { profiles, addProfile, updateProfile, deleteProfile, setActiveProfile, activeProfileId } = useProfileStore();
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileColor, setProfileColor] = useState('');

  const handleAddProfile = () => {
    if (profileName.trim()) {
      const newProfile: Profile = {
        id: generateId(),
        name: profileName.trim(),
        color: profileColor || generatePastelColor()
      };
      addProfile(newProfile);
      setIsAddingProfile(false);
      setProfileName('');
      setProfileColor('');
    }
  };

  const handleEditProfile = () => {
    if (profileName.trim() && editingProfileId) {
      updateProfile(editingProfileId, { 
        name: profileName.trim(),
        color: profileColor
      });
      setIsEditingProfile(false);
      setProfileName('');
      setEditingProfileId(null);
      setProfileColor('');
    }
  };

  const startEditingProfile = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setProfileColor(profile.color);
    setIsEditingProfile(true);
  };

  return (
    <section>
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
            <Group className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Profiles</h2>
            <p className="text-sm text-muted-foreground">
              Manage user profiles and their preferences
            </p>
          </div>
        </div>
      </div>

      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header with Add Button */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-medium text-foreground">User Profiles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create and manage different user profiles with custom settings
                </p>
              </div>
              <Button  
                onClick={() => {
                  setProfileName('');
                  setProfileColor(generatePastelColor());
                  setIsAddingProfile(true);
                }}
                view="outlined"
                size="m"
                className="flex items-center gap-2"
              >
                <Icon data={PersonPlus} className="h-4 w-4" />
                Add Profile
              </Button>
            </div>
            
            {/* Profiles Grid */}
            <div className="space-y-4">
              {profiles.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-lg">
                  <Group className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No profiles yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first profile to get started</p>
                  <Button 
                    onClick={() => {
                      setProfileName('');
                      setProfileColor(generatePastelColor());
                      setIsAddingProfile(true);
                    }}
                    view="outlined"
                  >
                    <Icon data={Plus} className="h-4 w-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profiles.map(profile => (
                    <Card 
                      key={profile.id} 
                      type="selection"
                      view="outlined"
                      selected={profile.id === activeProfileId}
                      className={cn(
                        "relative cursor-pointer transition-all duration-200 hover:shadow-md border",
                        profile.id === activeProfileId 
                          ? "border-primary/15 bg-muted/20" 
                          : "border-border/50 hover:border-border"
                      )}
                      onClick={() => {
                        setActiveProfile(profile.id);
                        if (typeof document !== 'undefined') {
                          document.body.style.setProperty('--theme-color', profile.color);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        {/* Active Badge */}
                        {profile.id === activeProfileId && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-[var(--accent-color)] text-primary text-xs font-medium px-2 py-1 rounded-full">
                              Active
                            </div>
                          </div>
                        )}

                        {/* Profile Info */}
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar variant="circle" className="h-12 w-12" style={{ background: profile.color }}>
                            <AvatarFallback variant="circle" className="font-semibold text-black dark:text-background text-lg" style={{ background: 'transparent' }}>
                              {profile.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{profile.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {profile.id === activeProfileId ? 'Currently active' : 'Click to activate'}
                            </p>
                          </div>
                        </div>

                        {/* Theme Info */}
                        {profile.theme && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                            {profile.theme === 'dark' && <Moon className="h-3 w-3" />}
                            {profile.theme === 'light' && <Sun className="h-3 w-3" />}
                            {profile.theme === 'system' && <Monitor className="h-3 w-3" />}
                            <span className="capitalize">{profile.theme} theme</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center pt-2 border-t border-border/30">
                          <Button 
                            view="outlined" 
                            size="m"
                            pin="round-clear"
                            className="flex-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingProfile(profile);
                            }}
                          >
                            <Icon data={PencilToSquare} className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            view="outlined-danger" 
                            size="m"
                            pin="brick-round"
                            aria-label="Delete profile"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProfile(profile.id);
                            }}
                          >
                            <Icon data={TrashBin} className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Profile Dialog */}
      <Dialog open={isAddingProfile} onOpenChange={(open) => {
        setIsAddingProfile(open);
        if (open) {
          setProfileColor(generatePastelColor());
        } else {
          setProfileName('');
          setProfileColor('');
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profileNameAdd">Profile Name</Label>
              <TextInput
                size="xl"
                id="profileNameAdd"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter profile name"
                autoFocus
              />
            </div>
            
            <div className="mt-2">
              <Label>Profile Preview</Label>
              <div className="flex items-center gap-3 mt-2 p-3 rounded-md border bg-muted/30">
                <Avatar variant="circle" className="h-10 w-10" style={{ background: profileColor }}>
                  <AvatarFallback variant="circle" className="font-semibold text-black dark:text-background" style={{ background: 'transparent' }}>
                    {profileName.trim() ? profileName.charAt(0).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">
                    {profileName.trim() || 'New Profile'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Button 
                      view="outlined" 
                      size="s" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setProfileColor(generatePastelColor())}
                    >
                      Generate New Color
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button view="outlined" onClick={() => {
              setIsAddingProfile(false);
              setProfileName('');
              setProfileColor('');
            }}>Cancel</Button>
            <Button view="action" onClick={handleAddProfile}>Add Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Profile Dialog */}
      <Dialog open={isEditingProfile} onOpenChange={(open) => {
        setIsEditingProfile(open);
        if (!open) {
          setProfileName('');
          setEditingProfileId(null);
          setProfileColor('');
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profileNameEdit">Profile Name</Label>
              <TextInput
                size="xl"
                id="profileNameEdit"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter profile name"
                autoFocus
              />
            </div>
            
            <div className="mt-2">
              <Label>Profile Preview</Label>
              <div className="flex items-center gap-3 mt-2 p-3 rounded-md border bg-muted/30">
                <Avatar variant="circle" className="h-10 w-10" style={{ background: profileColor }}>
                  <AvatarFallback variant="circle" className="font-semibold text-black dark:text-background" style={{ background: 'transparent' }}>
                    {profileName.trim() ? profileName.charAt(0).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">
                    {profileName.trim() || 'Profile'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Button 
                      view="outlined" 
                      size="s" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setProfileColor(generatePastelColor())}
                    >
                      Generate New Color
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button view="outlined" onClick={() => {
              setIsEditingProfile(false);
              setProfileName('');
              setEditingProfileId(null);
              setProfileColor('');
            }}>Cancel</Button>
            <Button view="action" onClick={handleEditProfile}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ProfileSettings