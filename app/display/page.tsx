'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export default function DisplayPage() {
  const searchParams = useSearchParams()
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const setFromRawPath = async (encodedPath: string) => {
    try {
      const raw = decodeURIComponent(encodedPath)
      const fileUrl = await invoke<string>('convert_file_path', { path: raw })
      setImageSrc(fileUrl)
    } catch (e) {
      // Fallback: try using decoded path directly
      try {
        setImageSrc(decodeURIComponent(encodedPath))
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    const initial = searchParams.get('image')
    if (initial) setFromRawPath(initial)

    let unlisten: (() => void) | undefined
    const setup = async () => {
      const off = await listen<{ path: string }>('update-image', (event) => {
        if (event.payload?.path) setFromRawPath(event.payload.path)
      })
      unlisten = () => off()
    }
    setup()
    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="display" className="w-full h-full object-contain" />
      ) : null}
    </div>
  );
}
