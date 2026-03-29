import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { buildInviteUrl } from '../lib/room'

interface Props {
  roomCode: string
  variant?: 'inline' | 'floating'
  floatingTopClass?: string
  darkMode?: boolean
  onDarkModeToggle?: () => void
}

export function InviteTools({
  roomCode,
  variant = 'inline',
  floatingTopClass = 'top-[36%]',
  darkMode = true,
  onDarkModeToggle,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const inviteUrl = useMemo(() => buildInviteUrl(roomCode), [roomCode])

  async function copyWithFallback(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // fallback below
    }

    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copiedByExec = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copiedByExec
    } catch {
      return false
    }
  }

  async function onCopy() {
    const ok = await copyWithFallback(inviteUrl)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  async function onOpenQr() {
    if (!qrDataUrl) {
      const dataUrl = await QRCode.toDataURL(inviteUrl, {
        margin: 1,
        width: 320,
      })
      setQrDataUrl(dataUrl)
    }
    setQrOpen(true)
  }

  return (
    <>
      {variant === 'floating' ? (
        <>
          {panelOpen ? (
            <button
              type="button"
              aria-label="Close share panel"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setPanelOpen(false)}
            />
          ) : null}
          <div className={`fixed right-0 z-50 -translate-y-1/2 ${floatingTopClass}`}>
            {!panelOpen ? (
              <button
                type="button"
                className={`rounded-l border border-r-0 px-2 py-3 shadow-md ${
                  darkMode
                    ? 'border-[#2d4a6a] bg-[#1a2d4a] text-[#f0d878]'
                    : 'border-[#2d4a6a] bg-[#1a2d4a] text-[#f0d878]'
                }`}
                onClick={() => setPanelOpen(true)}
                aria-label="Share room"
              >
                <img src="/icons/share.svg" alt="" className="h-5 w-5 invert" />
              </button>
            ) : (
              <div
                className={`mr-2 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded border border-[#2d4a6a] shadow-xl`}
              >
                <div className="bg-[#1a2d4a] px-3 py-2 text-center">
                  <span className="font-serif text-[11px] font-bold uppercase tracking-widest text-[#f0d878]">
                    Room
                  </span>
                  <p className="font-serif text-lg font-bold tracking-widest text-[#f0d878]">
                    {roomCode}
                  </p>
                </div>
                <div className={`space-y-2 p-3 ${darkMode ? 'bg-[#e8e0d0]' : 'bg-[#e8e0d0]'}`}>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded border border-[#2d4a6a]/50 bg-[#1a2d4a] px-3 py-2 text-xs font-semibold text-[#f0d878]"
                      onClick={() => { void onCopy() }}
                    >
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      className="rounded border border-[#2d4a6a]/50 bg-[#1a2d4a] px-3 py-2 text-xs font-semibold text-[#f0d878]"
                      onClick={() => { void onOpenQr() }}
                    >
                      QR
                    </button>
                  </div>
                  {onDarkModeToggle ? (
                    <button
                      className="w-full rounded border border-[#2d4a6a]/50 bg-[#d4ccbe] px-3 py-2 text-xs font-medium text-[#1a1208]"
                      onClick={onDarkModeToggle}
                    >
                      {darkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-[#2d4a6a]/50 bg-[#1a2d4a] px-3 py-2 text-xs font-semibold text-[#f0d878]"
            onClick={() => { void onCopy() }}
          >
            {copied ? 'Copied' : 'Copy Invite Link'}
          </button>
          <button
            className="rounded border border-[#2d4a6a]/50 bg-[#1a2d4a] px-3 py-2 text-xs font-semibold text-[#f0d878]"
            onClick={() => { void onOpenQr() }}
          >
            Show QR
          </button>
        </div>
      )}

      {qrOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm overflow-hidden rounded border-2 border-[#2d4a6a]">
            <div className="bg-[#1a2d4a] px-4 py-2 text-center">
              <span className="font-serif text-[11px] font-bold uppercase tracking-widest text-[#f0d878]">
                Scan to Join — {roomCode}
              </span>
            </div>
            <div className="bg-[#e8e0d0] p-4">
              <p className="mb-3 break-all text-xs text-[#3a4a5a]">{inviteUrl}</p>
              <div className="rounded bg-white p-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR code for room ${roomCode}`} className="mx-auto h-auto w-full" />
                ) : (
                  <p className="text-center text-sm text-slate-900">Generating QR...</p>
                )}
              </div>
              <button
                className="mt-3 w-full rounded border-2 border-[#2d4a6a] bg-[#1a2d4a] px-4 py-2 font-serif text-sm font-bold uppercase tracking-wider text-[#f0d878]"
                onClick={() => setQrOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
