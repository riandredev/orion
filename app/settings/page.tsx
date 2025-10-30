import { redirect } from 'next/navigation'

export default function SettingsIndexPage() {
  // Server-side redirect to avoid client-side loading state
  redirect('/settings/display')
}
