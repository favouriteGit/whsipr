'use client'

import { useState, useRef, useEffect } from 'react'
import { type Confession, getAnon, MOOD_LABELS } from '@/lib/supabase'

const SOCIALS = [
  {
    key: 'twitter',
    name: 'X / Twitter',
    icon: 'X',
    color: '#1DA1F2',
    neon: '#00d4ff',
    bg: '#000000',
    gradient: 'linear-gradient(135deg, #000000 0%, #0a1628 100%)',
    glow: 'rgba(0,212,255,0.3)',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    icon: '◈',
    color: '#E1306C',
    neon: '#ff2d78',
    bg: '#0a0010',
    gradient: 'linear-gradient(135deg, #0a0010 0%, #1a0020 50%, #0d0a00 100%)',
    glow: 'rgba(255,45,120,0.3)',
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    icon: '◉',
    color: '#25D366',
    neon: '#00ff88',
    bg: '#001a0d',
    gradient: 'linear-gradient(135deg, #001a0d 0%, #002a15 100%)',
    glow: 'rgba(0,255,136,0.3)',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    color: '#ff0050',
    neon: '#ff0050',
    bg: '#000000',
    gradient: 'linear-gradient(135deg, #000000 0%, #0d0010 100%)',
    glow: 'rgba(255,0,80,0.4)',
  },
  {
    key: 'threads',
    name: 'Threads',
    icon: '@',
    color: '#ffffff',
    neon: '#ffffff',
    bg: '#0a0a0a',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)',
    glow: 'rgba(255,255,255,0.15)',
  },
]

interface ShareCardProps {
  confession: Confession
  boardName: string
  onClose: () => void
}

export default function ShareCard({ confession, boardName, onClose }: ShareCardProps) {
  const [selected, setSelected] = useState(SOCIALS[0])
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const anon = getAnon(confession.anon_seed)
  const moodLabel = MOOD_LABELS[confession.mood] || ''

  // Draw card to canvas for download
  function drawCard(social: typeof SOCIALS[0]): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')!

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080)
    if (social.key === 'instagram') {
      bgGrad.addColorStop(0, '#0a0010')
      bgGrad.addColorStop(0.5, '#1a0020')
      bgGrad.addColorStop(1, '#0d0a00')
    } else if (social.key === 'whatsapp') {
      bgGrad.addColorStop(0, '#001a0d')
      bgGrad.addColorStop(1, '#002a15')
    } else if (social.key === 'tiktok') {
      bgGrad.addColorStop(0, '#000000')
      bgGrad.addColorStop(1, '#0d0010')
    } else if (social.key === 'threads') {
      bgGrad.addColorStop(0, '#0a0a0a')
      bgGrad.addColorStop(1, '#141414')
    } else {
      bgGrad.addColorStop(0, '#000000')
      bgGrad.addColorStop(1, '#0a1628')
    }
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 1080, 1080)

    // Glow orb
    const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 500)
    glow.addColorStop(0, social.glow)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, 1080, 1080)

    // Noise texture (subtle)
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 1080
      const y = Math.random() * 1080
      const alpha = Math.random() * 0.03
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fillRect(x, y, 1, 1)
    }

    // Border glow
    ctx.strokeStyle = social.neon
    ctx.lineWidth = 3
    ctx.shadowColor = social.neon
    ctx.shadowBlur = 20
    ctx.strokeRect(40, 40, 1000, 1000)
    ctx.shadowBlur = 0

    // Top corner decoration
    ctx.strokeStyle = social.neon
    ctx.lineWidth = 2
    ctx.shadowColor = social.neon
    ctx.shadowBlur = 10
    // Top left
    ctx.beginPath(); ctx.moveTo(40, 140); ctx.lineTo(40, 40); ctx.lineTo(140, 40); ctx.stroke()
    // Top right
    ctx.beginPath(); ctx.moveTo(940, 40); ctx.lineTo(1040, 40); ctx.lineTo(1040, 140); ctx.stroke()
    // Bottom left
    ctx.beginPath(); ctx.moveTo(40, 940); ctx.lineTo(40, 1040); ctx.lineTo(140, 1040); ctx.stroke()
    // Bottom right
    ctx.beginPath(); ctx.moveTo(940, 1040); ctx.lineTo(1040, 1040); ctx.lineTo(1040, 940); ctx.stroke()
    ctx.shadowBlur = 0

    // Whispr logo top
    ctx.font = 'italic bold 32px Georgia, serif'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.textAlign = 'center'
    ctx.fillText('whispr', 540, 110)

    // Mood emoji + label
    ctx.font = '52px serif'
    ctx.textAlign = 'center'
    ctx.fillText(confession.mood, 540, 220)

    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = social.neon
    ctx.letterSpacing = '4px'
    ctx.fillText(moodLabel.toUpperCase(), 540, 255)

    // Divider line
    ctx.strokeStyle = `rgba(255,255,255,0.1)`
    ctx.lineWidth = 1
    ctx.shadowBlur = 0
    ctx.beginPath(); ctx.moveTo(140, 290); ctx.lineTo(940, 290); ctx.stroke()

    // Quote mark
    ctx.font = 'italic bold 180px Georgia, serif'
    ctx.fillStyle = `${social.neon}15`
    ctx.textAlign = 'left'
    ctx.fillText('"', 80, 430)

    // Confession text
    const text = confession.text
    const maxWidth = 860
    const lineHeight = 72
    const fontSize = text.length > 200 ? 38 : text.length > 100 ? 46 : 54
    ctx.font = `italic ${fontSize}px Georgia, serif`
    ctx.fillStyle = '#f0ece4'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(255,255,255,0.1)'
    ctx.shadowBlur = 4

    // Word wrap
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line.trim())
        line = word + ' '
      } else {
        line = test
      }
    }
    lines.push(line.trim())

    const totalHeight = lines.length * lineHeight
    const startY = 540 - totalHeight / 2 + lineHeight / 2

    lines.forEach((l, i) => {
      ctx.fillText(l, 540, startY + i * lineHeight)
    })
    ctx.shadowBlur = 0

    // Divider bottom
    ctx.strokeStyle = `rgba(255,255,255,0.1)`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(140, 850); ctx.lineTo(940, 850); ctx.stroke()

    // Anon info
    ctx.font = 'bold 20px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.textAlign = 'left'
    ctx.fillText(`Anon #${anon.number}  ·  ${confession.mood} ${moodLabel}  ·  ${boardName}`, 110, 910)

    // Social watermark
    ctx.font = 'bold 22px monospace'
    ctx.fillStyle = social.neon
    ctx.textAlign = 'right'
    ctx.shadowColor = social.neon
    ctx.shadowBlur = 8
    ctx.fillText(`whispr.name.ng`, 970, 910)
    ctx.shadowBlur = 0

    // Social icon bottom right
    ctx.font = 'bold 28px monospace'
    ctx.fillStyle = social.neon
    ctx.textAlign = 'right'
    ctx.shadowColor = social.neon
    ctx.shadowBlur = 12
    ctx.fillText(social.icon, 970, 980)
    ctx.shadowBlur = 0

    return canvas
  }

  async function download() {
    setDownloading(true)
    setTimeout(() => {
      const canvas = drawCard(selected)
      const link = document.createElement('a')
      link.download = `whispr-confession-${selected.key}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setDownloading(false)
    }, 100)
  }

  function shareToSocial() {
    const text = `"${confession.text}" — anonymous confession on whispr.name.ng`
    const url = 'https://whispr.name.ng'

    if (selected.key === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
    } else if (selected.key === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`)
    } else if (selected.key === 'threads') {
      window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`)
    } else {
      // Instagram & TikTok don't support direct share links — download instead
      download()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease]"
         style={{ background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-[560px] animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">↗ Share Confession</div>
            <h2 className="font-playfair text-2xl font-bold">Pick your platform</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted hover:text-[var(--text)] transition-colors">✕</button>
        </div>

        {/* Social selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {SOCIALS.map(s => (
            <button key={s.key}
                    onClick={() => setSelected(s)}
                    className="flex flex-col items-center gap-1.5 px-4 py-3 border transition-all shrink-0"
                    style={{
                      borderColor: selected.key === s.key ? s.neon : 'var(--border)',
                      background: selected.key === s.key ? `${s.neon}12` : 'var(--surface2)',
                      boxShadow: selected.key === s.key ? `0 0 16px ${s.glow}` : 'none',
                    }}>
              <span className="text-lg font-bold" style={{ color: selected.key === s.key ? s.neon : 'rgba(240,236,228,0.4)' }}>
                {s.icon}
              </span>
              <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: selected.key === s.key ? s.neon : 'rgba(240,236,228,0.4)' }}>
                {s.name}
              </span>
            </button>
          ))}
        </div>

        {/* Card Preview */}
        <div className="relative rounded-none mb-6 overflow-hidden border"
             style={{
               borderColor: selected.neon,
               boxShadow: `0 0 40px ${selected.glow}, inset 0 0 40px ${selected.glow}30`,
               background: selected.gradient,
               aspectRatio: '1/1',
             }}>

          {/* Noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
               style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

          {/* Glow orb */}
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${selected.glow} 0%, transparent 65%)` }} />

          {/* Corner brackets */}
          {[['top-3 left-3', 'border-t-2 border-l-2 w-6 h-6'],
            ['top-3 right-3', 'border-t-2 border-r-2 w-6 h-6'],
            ['bottom-3 left-3', 'border-b-2 border-l-2 w-6 h-6'],
            ['bottom-3 right-3', 'border-b-2 border-r-2 w-6 h-6']
          ].map(([pos, cls], i) => (
            <div key={i} className={`absolute ${pos} ${cls}`} style={{ borderColor: selected.neon, boxShadow: `0 0 8px ${selected.neon}` }} />
          ))}

          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">

            {/* Whispr logo */}
            <div className="font-playfair italic text-xs tracking-[0.3em] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>whispr</div>

            {/* Mood */}
            <div className="text-3xl mb-1">{confession.mood}</div>
            <div className="font-mono text-[10px] tracking-[0.2em] mb-5" style={{ color: selected.neon }}>
              {moodLabel.toUpperCase()}
            </div>

            {/* Divider */}
            <div className="w-full h-px mb-5" style={{ background: 'rgba(255,255,255,0.1)' }} />

            {/* Big quote mark */}
            <div className="font-playfair italic text-[80px] leading-none absolute top-[28%] left-6 pointer-events-none select-none"
                 style={{ color: `${selected.neon}18` }}>"</div>

            {/* Confession text */}
            <p className="font-playfair italic leading-relaxed text-[var(--text)]"
               style={{ fontSize: confession.text.length > 150 ? '13px' : confession.text.length > 80 ? '15px' : '18px' }}>
              {confession.text}
            </p>

            {/* Divider */}
            <div className="w-full h-px mt-5 mb-3" style={{ background: 'rgba(255,255,255,0.1)' }} />

            {/* Footer */}
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Anon #{anon.number} · {boardName}
              </span>
              <span className="font-mono text-[10px] font-bold" style={{ color: selected.neon, textShadow: `0 0 8px ${selected.neon}` }}>
                whispr.name.ng
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={download} disabled={downloading}
                  className="flex-1 py-3 font-mono text-xs tracking-widest uppercase border transition-all disabled:opacity-40"
                  style={{ borderColor: selected.neon, color: selected.neon, background: `${selected.neon}10` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${selected.neon}20`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${selected.neon}10`)}>
            {downloading ? 'Generating...' : '↓ Download Image'}
          </button>

          <button onClick={shareToSocial}
                  className="flex-1 py-3 font-mono text-xs tracking-widest uppercase font-bold transition-all"
                  style={{ background: selected.neon, color: '#080808', boxShadow: `0 4px 20px ${selected.glow}` }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            {selected.key === 'instagram' || selected.key === 'tiktok'
              ? '↓ Save & Post'
              : `Share to ${selected.name}`}
          </button>
        </div>

        {(selected.key === 'instagram' || selected.key === 'tiktok') && (
          <p className="font-mono text-[10px] text-dim text-center mt-3">
            {selected.name} doesn't support direct sharing — download the image and post it manually
          </p>
        )}
      </div>
    </div>
  )
}
