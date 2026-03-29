import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { buildInviteUrl } from '../lib/room'

interface Props {
  roomCode: string
}

export function InviteTools({ roomCode }: Props) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const inviteUrl = useMemo(() => buildInviteUrl(roomCode), [roomCode])

  async function onCopy() {
    await navigator.clipboard.writeText(inviteUrl)
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
