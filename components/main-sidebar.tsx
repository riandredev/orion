"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Plus, Building2 } from "lucide-react"
import {
  Home,
  LibraryMusic,
  Book,
  MenuBook,
  Group,
  Settings,
  Stop,
  PlayArrow,
  AccessTimeFilled,
  MusicNote,
  
  Edit,
} from "@nine-thirty-five/material-icons-react/rounded"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Window } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProfileStore, generateId, generatePastelColor, type Profile } from "@/lib/stores/profile-store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listen } from "@tauri-apps/api/event"

export default function MainSidebar() {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState("0h 0m 0s")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [isEditingOrg, setIsEditingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [isAddingProfile, setIsAddingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")
  const [previewColor, setPreviewColor] = useState("")
  const [projectionPreviewContent, setProjectionPreviewContent] = useState<string | null>(null)
  const [projectionPreviewSource, setProjectionPreviewSource] = useState<string | null>(null)
  const pathname = usePathname()

  const {
    organizationName,
    profiles,
    activeProfileId,
    setOrganizationName,
    addProfile,
    deleteProfile,
    setActiveProfile,
  } = useProfileStore()

  useEffect(() => {
    // Check localStorage for organization name on mount and when it changes
    const checkOrgName = () => {
      const storedName = localStorage.getItem('orion-organization-name')
      if (storedName) {
        setOrganizationName(storedName)
      }
    }
    
    // Initial check
    checkOrgName()
    
    // Setup storage event listener
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'orion-organization-name') {
        checkOrgName()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [setOrganizationName])
  
  const handleSaveOrgName = () => {
    if (newOrgName.trim()) {
      setOrganizationName(newOrgName.trim())
    }
    setIsEditingOrg(false)
    setNewOrgName("")
  }

  const handleAddProfile = () => {
    if (newProfileName.trim()) {
      const newProfile: Profile = {
        id: generateId(),
        name: newProfileName.trim(),
        color: previewColor || generatePastelColor(),
      }
      addProfile(newProfile)

      if (profiles.length === 0) {
        setActiveProfile(newProfile.id)
      }
    }
    setIsAddingProfile(false)
    setNewProfileName("")
    setPreviewColor("")
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)

  const handleStopTimer = () => {
    setIsRunning(false)
    setStartTime(null)
    setElapsedTime("0h 0m 0s")
  }

  const handleToggleWindow = async () => {
    try {
      await invoke("stop_stream")
      const imageWindows = await invoke<string[]>("get_image_windows")
      const hymnWindows = await invoke<string[]>("get_hymn_windows")
      const bibleWindows = await invoke<string[]>("get_bible_windows")
      const allWindows = [...imageWindows, ...hymnWindows, ...bibleWindows]

      await invoke("clear_current_image")

      const stopEvent = new CustomEvent("stopTimer", {
        detail: { source: "main-stop" },
      })
      window.dispatchEvent(stopEvent)

      try {
        const projectionWindow = await Window.getByLabel("projection")
        if (projectionWindow) {
          await projectionWindow.emit("clear-all-content", {})
        }
      } catch (error) {
        console.error("Error notifying projection window:", error)
      }

      for (const windowLabel of allWindows) {
        try {
          const window = await Window.getByLabel(windowLabel)
          if (window) {
            await window.emit("stopTimer", { source: "main-stop" })
            await window.destroy()
          }
        } catch (error) {
          console.error(`Error closing window ${windowLabel}:`, error)
        }
      }

      if (allWindows.length > 0) {
        setIsRunning(false)
        setStartTime(null)
        setElapsedTime("0h 0m 0s")
      }
    } catch (error) {
      console.error("Error handling windows:", error)
    }
  }

  useEffect(() => {
    const handleStartTimer = () => {
      if (!isRunning) {
        setIsRunning(true)
        setStartTime(Date.now())
      }
    }

    const handleStopTimer = () => {
      const checkForActiveWindows = async () => {
        try {
          const imageWindows = await invoke<string[]>("get_image_windows")
          const hymnWindows = await invoke<string[]>("get_hymn_windows")
          const hasActiveWindows = imageWindows.length > 0 || hymnWindows.length > 0

          setIsRunning(false)
          setStartTime(null)
          setElapsedTime("0h 0m 0s")
        } catch (error) {
          console.error("Error checking windows:", error)
        }
      }

      checkForActiveWindows()
    }

    window.addEventListener("startTimer", handleStartTimer)
    window.addEventListener("stopTimer", handleStopTimer)

    const interval = setInterval(() => {
      if (isRunning && startTime) {
        const elapsed = Date.now() - startTime
        const hours = Math.floor(elapsed / (1000 * 60 * 60))
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
        setElapsedTime(`${hours}h ${minutes}m ${seconds}s`)
      }
    }, 1000)

    return () => {
      window.removeEventListener("startTimer", handleStartTimer)
      window.removeEventListener("stopTimer", handleStopTimer)
      clearInterval(interval)
    }
  }, [isRunning, startTime])

  useEffect(() => {
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI__
    if (!isTauri) return
  
    const unlistenPreviewUpdate = listen<{ content: string; source: string }>("window-preview-update", (event) => {
      if (event.payload && event.payload.content) {
        setProjectionPreviewContent(event.payload.content)
        setProjectionPreviewSource(event.payload.source || null)
      }
    })
  
    const unlistenPreviewClear = listen<{ source?: string }>("clear-projection-preview", (event) => {
      if (event.payload && event.payload.source) {
        if (projectionPreviewSource === event.payload.source) {
          setProjectionPreviewContent(null)
          setProjectionPreviewSource(null)
        }
      } else {
        setProjectionPreviewContent(null)
        setProjectionPreviewSource(null)
      }
    })
  
    return () => {
      unlistenPreviewUpdate.then((f) => f())
      unlistenPreviewClear.then((f) => f())
    }
  }, [projectionPreviewSource])

  const isActive = (path: string) => pathname === path

  return (
    <SidebarProvider cookieName="leftSidebar:state">
      <Sidebar className="border-r border-border/40 bg-sidebar-background">
        {/* Header with organization selector */}
        <SidebarHeader className="border-b border-border/40 p-3 space-y-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-10 px-3 justify-between hover:bg-accent/50 transition-colors data-[state=open]:bg-accent/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-md border border-sidebar-border flex items-center justify-center text-muted-foreground flex-shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium truncate">{organizationName}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Organization
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setNewOrgName(organizationName)
                          setIsEditingOrg(true)
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm font-medium truncate">{organizationName}</p>
                  </div>

                  <DropdownMenuSeparator />

                  <div className="p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Profiles
                      </span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddingProfile(true)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {profiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 px-1">No profiles yet</p>
                    ) : (
                      <div className="space-y-0.5">
                        {profiles.map((profile) => (
                          <DropdownMenuItem
                            key={profile.id}
                            className={cn(
                              "flex items-center gap-2.5 cursor-pointer rounded-md",
                              activeProfileId === profile.id && "bg-accent",
                            )}
                            onClick={() => {
                              setActiveProfile(profile.id)
                              document.body.style.setProperty("--theme-color", profile.color)
                            }}
                          >
                            <Avatar variant="circle" className="h-6 w-6" style={{ background: profile.color }}>
                              <AvatarFallback
                                variant="circle"
                                className="text-xs font-semibold text-background"
                                style={{ background: "transparent" }}
                              >
                                {profile.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-sm">{profile.name}</span>
                            {activeProfileId === profile.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Timer Card */}
          <div className="rounded-lg border border-border bg-accent/50 p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Session Time
                </div>
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{elapsedTime}</div>
              </div>
              <button
                onClick={handleToggleWindow}
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-200",
                  "hover:scale-105 active:scale-95",
                  isRunning
                    ? "bg-red-500/25 text-red-600 dark:bg-red-500/30 dark:text-red-400 hover:bg-red-500/35 dark:hover:bg-red-500/40"
                    : "bg-green-500/25 text-green-600 dark:bg-green-500/30 dark:text-green-400 hover:bg-green-500/35 dark:hover:bg-green-500/40",
                )}
              >
                {isRunning ? <Stop className="h-4 w-4" /> : <PlayArrow className="h-4 w-4" />}
              </button>
            </div>
            {isRunning && (
              <div className="h-1 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          {/* Main Navigation */}
          <SidebarGroup className="mb-4">
            <SidebarMenu className="space-y-0">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/" className="flex items-center gap-3">
                    <Home className="h-4 w-4" />
                    <span className="text-sm">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/hymns")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/hymns")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/hymns" className="flex items-center gap-3">
                    <LibraryMusic className="h-4 w-4" />
                    <span className="text-sm">Hymns</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/bible")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/bible")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/bible" className="flex items-center gap-3">
                    <Book className="h-4 w-4" />
                    <span className="text-sm">Bible</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/clock")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/clock")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/clock" className="flex items-center gap-3">
                    <AccessTimeFilled className="h-4 w-4" />
                    <span className="text-sm">Clock</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/sounds")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/sounds")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/sounds" className="flex items-center gap-3">
                    <MusicNote className="h-4 w-4" />
                    <span className="text-sm">Sounds</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          {/* Management Section */}
          <SidebarGroup>
            <div className="px-3 py-2 mb-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Management</h4>
            </div>
            <SidebarMenu className="space-y-0">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/hymn-index")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/hymn-index")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/hymn-index" className="flex items-center gap-3">
                    <MenuBook className="h-4 w-4" />
                    <span className="text-sm">Hymnal Index</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/manage-bible")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/manage-bible")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/bible" className="flex items-center gap-3">
                    <Book className="h-4 w-4" />
                    <span className="text-sm">Bible Index</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/members")}
                  className={cn(
                    "h-9 px-3 rounded-md transition-colors",
                    isActive("/members")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="#" className="flex items-center gap-3">
                    <Group className="h-4 w-4" />
                    <span className="text-sm">Church Members</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border/40 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/settings")}
                className={cn(
                  "h-9 px-3 rounded-md transition-colors",
                  isActive("/settings")
                    ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                    : "hover:bg-accent/50 border border-transparent",
                )}
              >
                <Link href="/settings" className="flex items-center gap-3">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {profiles.length > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/profiles")}
                  className={cn(
                    "h-16 px-3 rounded-md transition-colors",
                    isActive("/settings/profiles")
                      ? "bg-primary/5 text-primary font-medium hover:bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50 border border-transparent",
                  )}
                >
                  <Link href="/settings/profiles" className="flex items-center gap-3 min-w-0">
                    <Avatar
                      variant="circle"
                      className="h-6 w-6 flex-shrink-0"
                      style={activeProfile ? { background: activeProfile.color } : undefined}
                    >
                      <AvatarFallback variant="circle" className="text-[10px] text-black dark:text-black">
                        {activeProfile?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">
                      {activeProfile?.name || "Profiles"}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditingOrg} onOpenChange={setIsEditingOrg}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Organization Name</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOrgName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Profile Dialog */}
      <Dialog
        open={isAddingProfile}
        onOpenChange={(open) => {
          setIsAddingProfile(open)
          if (open) {
            setPreviewColor(generatePastelColor())
          } else {
            setNewProfileName("")
            setPreviewColor("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profileName">Profile Name</Label>
              <Input
                id="profileName"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Enter profile name"
                autoFocus
              />
            </div>

            <div className="mt-2">
              <Label>Profile Preview</Label>
              <div className="flex items-center gap-3 mt-2 p-3 rounded-md border bg-muted/30">
                <Avatar variant="circle" className="h-10 w-10" style={{ background: previewColor }}>
                  <AvatarFallback
                    variant="circle"
                    className="font-semibold text-background"
                    style={{ background: "transparent" }}
                  >
                    {newProfileName.trim() ? newProfileName.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{newProfileName.trim() || "New Profile"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs bg-transparent"
                      onClick={() => setPreviewColor(generatePastelColor())}
                    >
                      Generate New Color
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingProfile(false)
                setNewProfileName("")
                setPreviewColor("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddProfile}>Add Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
