'use client'

import { useState } from 'react'
import { type Confession, getAnon, MOOD_COLORS, MOOD_LABELS } from '@/lib/supabase'

const SOCIALS = [
  { key: 'twitter', name: 'X / Twitter', icon: '✕', color: '#1d9bf0', bg: '#000', gradient: 'linear-gradient(135deg,#000 0%,#0a1628 100%)', glow: 'rgba(29,155,240,0.3)' },
  { key: 'instagram', name: 'Instagram', icon: '◈', color: '#e1306c', bg: '#0a0010', gradient: 'linear-gradient(135deg,#0a0010 0%,#1a0020 100%)', glow: 'rgba(225,48,108,0.3)' },
  { key: 'whatsapp', name: 'WhatsApp', icon: '◉', color: '#25d366', bg: '#001a0d', gradient: 'linear-gradient(135deg,#001a0d 0%,#002a15 100%)', glow: 'rgba(37,211,102,0.3)' },
  { key: 'tiktok', name: 'TikTok', icon: '♪', color: '#ff0050', bg: '#000', gradient: 'linear-gradient(135deg,#000 0%,#0d0010 100%)', glow: 'rgba(255,0,80,0.3)' },
  { key: 'threads', name: 'Threads', icon: '@', color: '#fff', bg: '#0a0a0a', gradient: 'linear-gradient(135deg,#0a0a0a 0%,#141414 100%)', glow: 'rgba(255,255,255,0.1)' },
]

export default function ShareCard({ confession: c, boardName, onClose }: { confession: Confession; boardName: string; onClose: () => void }) {
  const [selected, setSelected] = useState(SOCIALS[0])
  const [downloading, setDownloading] = useState(false)
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#666'
  const moodLabel = MOOD_LABELS[c.mood] || ''

  function drawCard(social: typeof SOCIALS[0]): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1080
    const ctx = canvas.getContext('2d')!

    const bg = ctx.createLinearGradient(0, 0, 1080, 1080)
    const stops = social.gradient.match(/#[a-f0-9]+/gi) || ['#000', '#111']
    bg.addColorStop(0, stops[0]); bg.addColorStop(1, stops[1] || stops[0])
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1080)

    // Noise
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.025})`
      ctx.fillRect(Math.random()*1080, Math.random()*1080, 1, 1)
    }

    // Border
    ctx.strokeStyle = social.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.4
    ctx.strokeRect(40, 40, 1000, 1000); ctx.globalAlpha = 1

    // Logo
    ctx.font = 'italic bold 28px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.textAlign = 'center'
    ctx.fillText('whispr', 540, 100)

    // Mood
    ctx.font = '60px serif'; ctx.fillText(c.mood, 540, 200)
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = social.color; ctx.letterSpacing = '4px'
    ctx.fillText(moodLabel.toUpperCase(), 540, 240)

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(100, 275); ctx.lineTo(980, 275); ctx.stroke()

    // Confession text
    const words = c.text.split(' ')
    const fontSize = c.text.length > 200 ? 36 : c.text.length > 100 ? 44 : 52
    ctx.font = `italic ${fontSize}px Georgia, serif`; ctx.fillStyle = '#ededed'; ctx.textAlign = 'center'
    let line = ''; const lines: string[] = []
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > 880 && line) { lines.push(line.trim()); line = word + ' ' }
      else line = test
    }
    lines.push(line.trim())
    const startY = 540 - (lines.length * (fontSize * 1.4)) / 2
    lines.forEach((l, i) => ctx.fillText(l, 540, startY + i * fontSize * 1.4))

    // Bottom divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(100, 860); ctx.lineTo(980, 860); ctx.stroke()

    // Footer
    ctx.font = '18px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'left'
    ctx.fillText(`Anon #${anon.number} · ${boardName}`, 100, 910)
    ctx.fillStyle = social.color; ctx.textAlign = 'right'
    ctx.fillText('whispr.name.ng', 980, 910)

    return canvas
  }

  function download() {
    setDownloading(true)
    setTimeout(() => {
      const canvas = drawCard(selected)
      const link = document.createElement('a')
      link.download = `whispr-${selected.key}.png`
      link.href = canvas.toDataURL('image/png')
      link.click(); setDownloading(false)
    }, 100)
  }

  function share() {
    const text = `"${c.text}" — anonymous on whispr.name.ng`
    if (selected.key === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`)
    else if (selected.key === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
    else if (selected.key === 'threads') window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`)
    else download()
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
         style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.15s ease' }}>

      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-focus)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', animation: 'slideUp 0.2s ease', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Share confession</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Pick a platform to share to</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {/* Platform tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
          {SOCIALS.map(s => (
            <button key={s.key} onClick={() => setSelected(s)}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', background: selected.key === s.key ? 'var(--bg-hover)' : 'transparent', border: `1px solid ${selected.key === s.key ? 'var(--border-focus)' : 'var(--border)'}`, color: selected.key === s.key ? 'var(--text)' : 'var(--text-tertiary)' }}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '16px', aspectRatio: '1', background: selected.gradient, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', boxShadow: `0 0 32px ${selected.glow}` }}>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(255,255,255,0.25)', marginBottom: '12px', letterSpacing: '0.2em' }}>whispr</p>
          <p style={{ fontSize: '28px', marginBottom: '4px' }}>{c.mood}</p>
          <p style={{ fontSize: '10px', color: selected.color, letterSpacing: '0.15em', marginBottom: '16px', fontFamily: 'monospace' }}>{moodLabel.toUpperCase()}</p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }} />
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '14px', color: '#ededed', lineHeight: 1.65, maxHeight: '120px', overflow: 'hidden' }}>{c.text}</p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '16px', marginBottom: '10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>Anon #{anon.number}</span>
            <span style={{ fontSize: '10px', color: selected.color, fontFamily: 'monospace' }}>whispr.name.ng</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={download} disabled={downloading} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', opacity: downloading ? 0.5 : 1 }}>
            {downloading ? 'Generating...' : '↓ Download'}
          </button>
          <button onClick={share} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            {selected.key === 'instagram' || selected.key === 'tiktok' ? '↓ Save & Post' : `Share →`}
          </button>
        </div>
        {(selected.key === 'instagram' || selected.key === 'tiktok') && (
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
            {selected.name} doesn't support direct sharing — save and post manually
          </p>
        )}
      </div>
    </div>
  )
}