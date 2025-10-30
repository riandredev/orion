'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X, Monitor, Database, Palette, Search, } from 'lucide-react';
import { Book, Church, Person } from '@nine-thirty-five/material-icons-react/rounded';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TextInput } from '@gravity-ui/uikit'
import { Display } from '@gravity-ui/icons';

const settingsSections = [  
  { id: 'display', label: 'Display', icon: Display, href: '/settings/display' },
  { id: 'organization', label: 'Organization', icon: Church, href: '/settings/organization' },
  { id: 'hymns', label: 'Hymns', icon: Database, href: '/settings/hymns' },
  { id: 'bible', label: 'Bible', icon: Book, href: '/settings/bible' },
  { id: 'profiles', label: 'Profiles', icon: Person, href: '/settings/profiles' },
  { id: 'appearance', label: 'Appearance', icon: Palette, href: '/settings/appearance' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = () => {
    router.push('/');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredSections = settingsSections.filter((section) =>
    section.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-card-background border border-border rounded-md hover:bg-accent transition-colors"
      >
        <X className="h-4 w-4" />
        <span className="text-sm font-medium">ESC</span>
      </button>

      <div className="flex h-full overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-full max-w-[600px] min-w-[300px] lg:w-[400px] xl:w-[500px] 2xl:w-[600px] pt-14 pl-4 sm:pl-8 md:pl-16 lg:pl-32 xl:pl-64 2xl:pl-80 bg-sidebar-background border-r border-border flex flex-col overflow-y-auto">
          <div className="px-6">
            {/* Search bar */}
            <div className="mb-6">
              <TextInput
                value={searchQuery}
                onUpdate={setSearchQuery}
                placeholder="Search settings..."
                size="xl"
                className="w-full"
              />
            </div>
            {/* Small label styled like main sidebar */}
            <div className="px-1 py-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                General Settings
              </h4>
            </div>
          </div>
          <nav className="flex-1 px-3 sm:px-4 pt-1">
            <ul className="space-y-1">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = pathname === section.href;
                return (
                  <li key={section.id}>
                    <Link
                      href={section.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{section.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 bg-background overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-5xl h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}