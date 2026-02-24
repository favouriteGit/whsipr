'use client'

import { useState } from 'react'
import { type Confession, getAnon, MOOD_LABELS } from '@/lib/supabase'

const SOCIALS = [
  { key: 'twitter',   name: 'X / TWITTER', color: '#1d9bf0' },
  { key: 'whatsapp',  name: 'WHATSAPP',    color: '#25d366' },
  { key: 'threads',   name: 'THREADS',     color: '#e4e4e7' },
  { key: 'instagram', name: 'INSTAGRAM',   color: '#e1306c' },
  { key: 'tiktok',    name: 'TIKTOK',      color: '#ff0050' },
]

export default function ShareCard({ confession: c, boardName, onClose }: { confession: Confession; boardName: string; onClose: () => void }) {
  const [sel, setSel] = useState(SOCIALS[0])
  const [downloading, setDownloading] = useState(false)
  const anon = getAnon(c.anon_seed)
  const moodLabel = MOOD_LABELS[c.mood] || 'NEUTRAL'

  function drawCard(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 1000
    const ctx = canvas.getContext('2d')!

    // Paper background
    ctx.fillStyle = '#f5f2eb'; ctx.fillRect(0, 0, 800, 1000)

    // Noise texture
    for (let i = 0; i < 8000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.018})`
      ctx.fillRect(Math.random() * 800, Math.random() * 1000, 1, 1)
    }

    // Border
    ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 2; ctx.strokeRect(20, 20, 760, 960)
    ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 1; ctx.strokeRect(28, 28, 744, 944)

    const cx = 400
    ctx.fillStyle = '#1a1a18'
    ctx.font = 'bold 32px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'; ctx.fillText('WHISPR', cx, 90)

    ctx.font = '13px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#6b6b67'; ctx.fillText('ANONYMOUS CONFESSIONS CO.', cx, 114)
    ctx.fillText('whispr.name.ng', cx, 134)

    // Dashed line helper
    function dashLine(y: number) {
      ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(760, y); ctx.stroke(); ctx.restore()
    }

    dashLine(155)

    // Meta
    ctx.font = '13px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#6b6b67'
    const meta = [
      ['ANON', `${anon.letter}${anon.number}`],
      ['MOOD', moodLabel.toUpperCase()],
      ['BOARD', boardName.toUpperCase().slice(0,24)],
    ]
    meta.forEach(([k,v], i) => {
      ctx.fillStyle = '#6b6b67'; ctx.fillText(k, 50, 185 + i * 24)
      ctx.fillStyle = '#1a1a18'; ctx.textAlign = 'right'; ctx.fillText(v, 750, 185 + i * 24)
      ctx.textAlign = 'left'
    })

    dashLine(270)

    // Confession text
    ctx.font = 'italic 22px Georgia, serif'; ctx.fillStyle = '#1a1a18'; ctx.textAlign = 'center'
    const words = c.text.split(' '); let line = ''; const lines: string[] = []
    for (const w of words) {
      const t = line + w + ' '
      if (ctx.measureText(t).width > 680 && line) { lines.push(line.trim()); line = w + ' ' }
      else line = t
    }
    lines.push(line.trim())
    const startY = 370 - (lines.length * 34) / 2
    lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * 34))

    dashLine(740)

    // Footer
    ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#9b9b96'; ctx.textAlign = 'center'
    ctx.fillText('** KEEP THIS RECEIPT **', cx, 775)
    ctx.fillText('THANK YOU FOR YOUR CONFESSION', cx, 797)

    // Barcode simulation
    const barY = 820; const barH = 60
    const barWidths = [2,1,3,2,1,2,3,1,2,1,3,2,1,3,2,1,2,3,1,2,1,2,3,1,2,3,1,2]
    let bx = 220
    barWidths.forEach((w, i) => {
      if (i % 2 === 0) { ctx.fillStyle = '#1a1a18'; ctx.fillRect(bx, barY, w * 3, barH) }
      bx += w * 3
    })
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#6b6b67'
    ctx.fillText(`TXN#WSPR-${c.id.slice(-8).toUpperCase()}`, cx, barY + barH + 18)

    return canvas
  }

  function download() {
    setDownloading(true)
    setTimeout(() => {
      const cv = drawCard()
      const l = document.createElement('a'); l.download = 'whispr-receipt.png'; l.href = cv.toDataURL('image/png'); l.click()
      setDownloading(false)
    }, 100)
  }

  function share() {
    const t = `"${c.text}" — posted anonymously on whispr.name.ng`
    if (sel.key === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`)
    else if (sel.key === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(t)}`)
    else if (sel.key === 'threads') window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(t)}`)
    else download()
  }

  return (
    <div className="overlay anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-up" style={{ maxWidth: '460px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em' }}>SHARE RECEIPT</p>
            <p className="label" style={{ marginTop: '2px' }}>SELECT PLATFORM</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '16px', fontFamily: "'IBM Plex Mono',monospace" }}>✕</button>
        </div>

        <div className="dash-line" style={{ marginBottom: '14px' }} />

        {/* Platform list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
          {SOCIALS.map(s => (
            <button key={s.key} onClick={() => setSel(s)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: `1px solid ${sel.key === s.key ? 'var(--ink)' : 'var(--ink-5)'}`, background: sel.key === s.key ? 'var(--ink)' : 'transparent', color: sel.key === s.key ? 'var(--paper)' : 'var(--ink-3)', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', letterSpacing: '0.06em', textAlign: 'left', width: '100%', transition: 'all 0.1s' }}>
              <span>{s.name}</span>
              {sel.key === s.key && <span>✓ SELECTED</span>}
            </button>
          ))}
        </div>

        <div className="dash-line" style={{ marginBottom: '14px' }} />

        {/* Receipt preview */}
        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--ink-5)', padding: '16px', fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', lineHeight: 1.8, marginBottom: '14px' }}>
          <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '6px' }}>WHISPR</div>
          <div className="dash-line" style={{ marginBottom: '8px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-3)' }}>
            <span>ANON</span><span>#{anon.number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-3)' }}>
            <span>MOOD</span><span>{moodLabel.toUpperCase()}</span>
          </div>
          <div className="dash-line" style={{ margin: '8px 0' }} />
          <p style={{ fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.6, fontSize: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const }}>
            &ldquo;{c.text}&rdquo;
          </p>
          <div className="dash-line" style={{ margin: '8px 0' }} />
          <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: '10px' }}>whispr.name.ng</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={download} disabled={downloading} className="btn-secondary" style={{ flex: 1, opacity: downloading ? 0.5 : 1 }}>
            {downloading ? 'GENERATING...' : '↓ DOWNLOAD'}
          </button>
          <button onClick={share} className="btn-primary" style={{ flex: 1 }}>
            {sel.key === 'instagram' || sel.key === 'tiktok' ? 'SAVE & POST' : 'SHARE →'}
          </button>
        </div>
      </div>
    </div>
  )
}
