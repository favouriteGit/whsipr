'use client'

import { useState } from 'react'
import { type Confession, getAnon, MOOD_COLORS, MOOD_LABELS } from '@/lib/supabase'

const SOCIALS = [
  { key: 'twitter',   name: 'X / Twitter', color: '#1d9bf0', bg: '#000',    grad: ['#000000','#0a1628'] },
  { key: 'instagram', name: 'Instagram',   color: '#e1306c', bg: '#0a0010', grad: ['#0a0010','#1a0020'] },
  { key: 'whatsapp',  name: 'WhatsApp',    color: '#25d366', bg: '#001a0d', grad: ['#001a0d','#002a15'] },
  { key: 'tiktok',    name: 'TikTok',      color: '#ff0050', bg: '#000',    grad: ['#000000','#0d0010'] },
  { key: 'threads',   name: 'Threads',     color: '#e4e4e7', bg: '#0a0a0a', grad: ['#0a0a0a','#141414'] },
]

export default function ShareCard({ confession: c, boardName, onClose }: { confession: Confession; boardName: string; onClose: () => void }) {
  const [sel, setSel] = useState(SOCIALS[0])
  const [downloading, setDownloading] = useState(false)
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#888'
  const moodLabel = MOOD_LABELS[c.mood] || ''

  function drawCard(s: typeof SOCIALS[0]): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1080
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0,0,1080,1080)
    g.addColorStop(0, s.grad[0]); g.addColorStop(1, s.grad[1])
    ctx.fillStyle = g; ctx.fillRect(0,0,1080,1080)
    for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random()*.02})`; ctx.fillRect(Math.random()*1080,Math.random()*1080,1,1) }
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.3; ctx.strokeRect(40,40,1000,1000); ctx.globalAlpha = 1
    ctx.font = 'italic bold 26px Georgia,serif'; ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.textAlign = 'center'; ctx.fillText('whispr', 540, 100)
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = s.color; ctx.fillText(moodLabel.toUpperCase(), 540, 200)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(100,230); ctx.lineTo(980,230); ctx.stroke()
    const words = c.text.split(' '); const fs = c.text.length > 200 ? 36 : c.text.length > 100 ? 44 : 52
    ctx.font = `italic ${fs}px Georgia,serif`; ctx.fillStyle = '#f4f4f5'; ctx.textAlign = 'center'
    let line = ''; const lines: string[] = []
    for (const w of words) { const t = line+w+' '; if (ctx.measureText(t).width > 880 && line) { lines.push(line.trim()); line = w+' ' } else line = t }
    lines.push(line.trim())
    const sy = 540 - (lines.length*(fs*1.4))/2
    lines.forEach((l,i) => ctx.fillText(l, 540, sy+i*fs*1.4))
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(100,860); ctx.lineTo(980,860); ctx.stroke()
    ctx.font = '16px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.textAlign = 'left'; ctx.fillText(`Anon #${anon.number} · ${boardName}`, 100, 910)
    ctx.fillStyle = s.color; ctx.textAlign = 'right'; ctx.fillText('whispr.name.ng', 980, 910)
    return canvas
  }

  function download() {
    setDownloading(true)
    setTimeout(() => { const cv = drawCard(sel); const l = document.createElement('a'); l.download = `whispr-${sel.key}.png`; l.href = cv.toDataURL('image/png'); l.click(); setDownloading(false) }, 100)
  }

  function share() {
    const t = `"${c.text}" — anonymous on whispr.name.ng`
    if (sel.key === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`)
    else if (sel.key === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(t)}`)
    else if (sel.key === 'threads') window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(t)}`)
    else download()
  }

  return (
    <div className="overlay anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-up" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Share confession</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Pick a platform</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {/* Platform tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px' }}>
          {SOCIALS.map(s => (
            <button key={s.key} onClick={() => setSel(s)}
                    style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all 0.15s', background: sel.key === s.key ? 'var(--bg-3)' : 'transparent', border: `1px solid ${sel.key === s.key ? 'var(--border-2)' : 'var(--border)'}`, color: sel.key === s.key ? 'var(--text)' : 'var(--text-3)' }}>
              {s.name}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border-2)', marginBottom: '16px', aspectRatio: '1', background: `linear-gradient(135deg, ${sel.grad[0]}, ${sel.grad[1]})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', boxShadow: `0 0 24px ${sel.color}20` }}>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginBottom: '10px', letterSpacing: '0.2em' }}>whispr</p>
          <p style={{ fontSize: '11px', color: sel.color, letterSpacing: '0.15em', marginBottom: '14px', fontFamily: 'monospace', textTransform: 'uppercase' }}>{moodLabel}</p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '14px' }} />
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '14px', color: '#f4f4f5', lineHeight: 1.65, overflow: 'hidden', maxHeight: '100px' }}>{c.text}</p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', marginTop: '14px', marginBottom: '10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>Anon #{anon.number}</span>
            <span style={{ fontSize: '10px', color: sel.color, fontFamily: 'monospace' }}>whispr.name.ng</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={download} disabled={downloading} className="btn-secondary" style={{ flex: 1, opacity: downloading ? 0.5 : 1 }}>
            {downloading ? 'Generating...' : '↓ Download'}
          </button>
          <button onClick={share} className="btn-primary" style={{ flex: 1 }}>
            {sel.key === 'instagram' || sel.key === 'tiktok' ? 'Save & Post' : 'Share →'}
          </button>
        </div>
        {(sel.key === 'instagram' || sel.key === 'tiktok') && (
          <p style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', marginTop: '8px' }}>
            {sel.name} doesn't support direct links — save and post manually
          </p>
        )}
      </div>
    </div>
  )
}
