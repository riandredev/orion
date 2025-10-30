'use client'

import { useState } from 'react'
import { Church, Group } from '@nine-thirty-five/material-icons-react/rounded'
import { PencilToSquare, PersonPlus, TrashBin } from '@gravity-ui/icons'
import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button, Icon, Card, TextInput } from '@gravity-ui/uikit'
import { Input } from "@/components/ui/input"
import { useProfileStore, generatePastelColor, generateId, Profile } from "@/lib/stores/profile-store"

function OrganizationSettings() {
  const { organizationName, setOrganizationName } = useProfileStore();
  const [name, setName] = useState(organizationName);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (name.trim()) {
      setOrganizationName(name.trim());
      setIsEditing(false);
    }
  };

return (
    <section>
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-background border dark:border-foreground/20">
            <Church className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-foreground">Organization</h2>
            <p className="text-sm text-muted-foreground">
              Configure your organization details and branding
            </p>
          </div>
        </div>
      </div>

      {/* Organization Name Setting */}
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium text-foreground mb-1">Organization Name</h3>
              <p className="text-sm text-muted-foreground">
                This name appears in the sidebar and presentation windows
              </p>
            </div>
            
            {isEditing ? (
              <div className="space-y-4 p-4 bg-muted/20 rounded-lg border border-dashed border-primary/15">
                <div className="space-y-2 flex flex-col">
                  <TextInput 
                    id="organizationName" 
                    size='xl'
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter organization name" 
                    className="max-w-md"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    view="outlined" 
                    size="m"
                    onClick={() => {
                      setName(organizationName);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button view="action" size="m" onClick={handleSave}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed border-primary/15 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-background border">
                    <Church className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{organizationName}</p>
                    <p className="text-xs text-muted-foreground">Current organization name</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsEditing(true)}
                  view="outlined" 
                  size="m"
                  className="gap-2"
                >
                  <Icon data={PencilToSquare} size={16} />
                  Edit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default OrganizationSettings