import { notFound } from 'next/navigation'
import { GeneralSettings } from '@/components/settings/general-settings'
import { DisplaySettings } from '@/components/settings/display-settings'
import { HymnsSettings } from '@/components/settings/hymns-settings'
import { BibleSettings } from '@/components/settings/bible-settings'
import { AppearanceSettings } from '@/components/settings/appearance-settings'
import OrganizationSettings from '@/components/settings/organization-settings'
import ProfileSettings from '@/components/settings/profile-settings'

interface SettingsPageProps {
  params: {
    section: string
  }
}

const settingsComponents = {
  general: GeneralSettings,
  display: DisplaySettings,
  hymns: HymnsSettings,
  bible: BibleSettings,
  appearance: AppearanceSettings,
  organization: OrganizationSettings,
  profiles: ProfileSettings,
}

const settingsTitles = {
  general: 'General Settings',
  display: 'Display Settings', 
  hymns: 'Hymns Settings',
  bible: 'Bible Settings',
  appearance: 'Appearance Settings',
  organization: 'Organization Settings',
  profiles: 'Profile Settings',
}

export function generateStaticParams() {
  return [
    { section: 'general' },
    { section: 'display' },
    { section: 'hymns' },
    { section: 'bible' },
    { section: 'appearance' },
    { section: 'organization' },
    { section: 'profiles' },
  ]
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { section } = params
  
  if (!settingsComponents[section as keyof typeof settingsComponents]) {
    notFound()
  }

  const SettingsComponent = settingsComponents[section as keyof typeof settingsComponents]
  const title = settingsTitles[section as keyof typeof settingsTitles]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="py-8 border-b">
            <div className="flex items-center">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
                <p className="text-muted-foreground mt-1 text-sm">     
                  {section === 'display' && 'Configure display and projection settings'}
                  {section === 'organization' && 'Manage your organization settings'}
                  {section === 'hymns' && 'Manage hymn database and scraping settings'}
                  {section === 'bible' && 'Configure Bible display and background settings'}
                  {section === 'profiles' && 'Manage your profile preferences'}
                  {section === 'appearance' && 'Customize the application appearance and theme'}
                </p>
              </div>
            </div>
          </div>

          {/* Settings Content */}
          <div className="py-8">
            <SettingsComponent />
          </div>
        </div>
      </div>
    </div>
  )
}