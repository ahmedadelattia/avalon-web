import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { buildInviteUrl } from '../lib/room'

interface Props {
  roomCode: string
  variant?: 'inline' | 'floating'
  floatingTopClass?: string
}

export function InviteTools({
  roomCode,
  variant = 'inline',
  floatingTopClass = 'top-[36%]',
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
                className="rounded-l-xl border border-r-0 border-slate-700 bg-slate-900/95 px-2 py-3 text-slate-100 shadow-lg"
                onClick={() => setPanelOpen(true)}
                aria-label="Share room"
              >
                <img src="/icons/share.svg" alt="" className="h-5 w-5" />
              </button>
            ) : (
              <div className="mr-2 w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <button
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold"
                    onClick={() => {
                      void onCopy()
                    }}
                  >
                    {copied ? 'Copied' : 'Copy Invite Link'}
                  </button>
                  <button
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold"
                    onClick={() => {
                      void onOpenQr()
                    }}
                  >
                    Show QR
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold"
            onClick={() => {
              void onCopy()
            }}
          >
            {copied ? 'Copied' : 'Copy Invite Link'}
          </button>
          <button
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold"
            onClick={() => {
              void onOpenQr()
            }}
          >
            Show QR
          </button>
        </div>
      )}

      {qrOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-slate-100">Scan to Join Room {roomCode}</p>
            <p className="mt-1 break-all text-xs text-slate-400">{inviteUrl}</p>
            <div className="mt-3 rounded-xl bg-white p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR code for room ${roomCode}`} className="mx-auto h-auto w-full" />
              ) : (
                <p className="text-center text-sm text-slate-900">Generating QR...</p>
              )}
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
              onClick={() => setQrOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
