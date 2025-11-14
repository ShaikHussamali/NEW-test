import React, { useEffect, useRef, useState } from 'react'

// Backend URL config: prefer runtime override from backend-config.js (window.BACKEND_WS_URL)
const WS_BASE = (() => {
  try {
    if (typeof window !== 'undefined' && window.BACKEND_WS_URL) return window.BACKEND_WS_URL
    const host = window.location.hostname
    return `ws://${host || 'localhost:8000'}/ws/`
  } catch (e) {
    return 'ws://localhost:8000/ws/'
  }
})()

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

// draw a simple humanoid character with head, body, arms, legs and costume
function drawCharacter(ctx, x, y, angle, id, charId = 'naruto', armProgress = 0, selected=false) {
  // sizes
  const headR = 10
  const bodyH = 24
  const bodyW = 18

  // determine colors by character id
  let costume = { body:'#ffcc00', trim:'#663300', head:'#ffd9a6' }
  if (charId === 'sasuke') costume = { body:'#223344', trim:'#000', head:'#ffd9a6' }
  if (charId === 'kakashi') costume = { body:'#bdbdbd', trim:'#222', head:'#ffd9a6' }
  if (charId === 'obito') costume = { body:'#800000', trim:'#331111', head:'#ffd9a6' }

  // body center
  ctx.save()
  ctx.translate(x, y)
  // draw legs
  ctx.strokeStyle = costume.trim
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-6, bodyH/2)
  ctx.lineTo(-6, bodyH/2 + 14)
  ctx.moveTo(6, bodyH/2)
  ctx.lineTo(6, bodyH/2 + 14)
  ctx.stroke()

  // draw body
  ctx.fillStyle = costume.body
  ctx.fillRect(-bodyW/2, -bodyH/2, bodyW, bodyH)
  ctx.strokeStyle = costume.trim
  ctx.strokeRect(-bodyW/2, -bodyH/2, bodyW, bodyH)

  // arms: left and right; armProgress 0..1 extends right arm forward
  const armLen = 18
  // base arm positions
  const leftArm = { x:-bodyW/2, y:-6 }
  const rightArm = { x:bodyW/2, y:-6 }

  // compute forward offset for right arm when throwing
  const throwOffset = armProgress > 0 ? (1 - Math.pow(1 - armProgress, 2)) * armLen : 0

  ctx.strokeStyle = '#222'
  ctx.lineWidth = 3
  ctx.beginPath()
  // left arm (static)
  ctx.moveTo(leftArm.x, leftArm.y)
  ctx.lineTo(leftArm.x - 10, leftArm.y + 8)
  // right arm (may extend)
  ctx.moveTo(rightArm.x, rightArm.y)
  const rx = rightArm.x + Math.cos(angle) * (8 + throwOffset)
  const ry = rightArm.y + Math.sin(angle) * (8 + throwOffset)
  ctx.lineTo(rx, ry)
  ctx.stroke()

  // head
  ctx.fillStyle = costume.head
  ctx.beginPath()
  ctx.arc(0, -bodyH/2 - headR, headR, 0, Math.PI*2)
  ctx.fill()
  ctx.strokeStyle = costume.trim
  ctx.stroke()

  // simple costume marks (mask for kakashi, swirl for naruto)
  if (charId === 'kakashi') {
    ctx.fillStyle = '#222'
    ctx.fillRect(-headR, -bodyH/2 - headR - 4, headR*2, 6)
  }
  if (charId === 'naruto') {
    ctx.strokeStyle = '#ff6600'
    ctx.beginPath()
    ctx.arc(0, -bodyH/2 - headR, 4, 0, Math.PI*2)
    ctx.stroke()
  }

  // highlight if selected
  if (selected) {
    ctx.strokeStyle = '#0cf'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.rect(-bodyW/2 - 4, -bodyH/2 - headR - 4, bodyW + 8, bodyH + headR + 10)
    ctx.stroke()
  }

  ctx.restore()

  // return approximate hand position (world coords) for right hand
  const handX = x + Math.cos(angle) * (8 + (armProgress > 0 ? (1 - Math.pow(1 - armProgress, 2)) * armLen : 0)) + bodyW/2
  const handY = y + Math.sin(angle) * (8 + (armProgress > 0 ? (1 - Math.pow(1 - armProgress, 2)) * armLen : 0)) - 6
  return { x: handX, y: handY }
}

export default function GameCanvas({ character = 'naruto', running = false, resetCounter = 0, onScoreChange = () => {} }) {
  const canvasRef = useRef(null)
  const [ws, setWs] = useState(null)
  const playersRef = useRef({})
  const playerIdRef = useRef(null)
  const resetRef = useRef(resetCounter)

  useEffect(() => {
    // preload naruto image from public folder
    let narutoImg = new Image()
    narutoImg.src = '/naruto.png'
    let narutoLoaded = false
    narutoImg.onload = () => { narutoLoaded = true }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = 800
    canvas.height = 600

  // local player state
  const player = { x: 400, y: 300, angle: 0, color: 'blue', health: 5 }
  // set color based on selected character
  switch (character) {
    case 'naruto': player.color = '#ffcc00'; break
    case 'sasuke': player.color = '#334455'; break
    case 'kakashi': player.color = '#bbbbbb'; break
    case 'obito': player.color = '#800000'; break
    default: player.color = 'blue'
  }
  // AI player (computer)
  const ai = { id: 'ai', x: 200, y: 150, angle: 0, color: 'green', health: 5, cooldown: 0 }
    const speed = 200 // px per second

  // bullets (local only): {x,y,vx,vy,owner,ttl,fromHand}
  const bullets = []

  // hand positions computed per frame
  let handPosPlayer = { x: player.x, y: player.y }
  let handPosAI = { x: ai.x, y: ai.y }

  let mousePos = { x: player.x, y: player.y }

    let keys = {}

    function handleKey(e) {
      keys[e.key] = e.type === 'keydown'
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    function handleMouse(e) {
      const rect = canvas.getBoundingClientRect()
      mousePos.x = e.clientX - rect.left
      mousePos.y = e.clientY - rect.top
    }
    function handleClick(e) {
      if (!running) return
      // player throws from hand towards mouse
      spawnBullet('player', true)
    }
    canvas.addEventListener('mousemove', handleMouse)
    canvas.addEventListener('mousedown', handleClick)

    // WebSocket connection (assign a random client id after open)
    const randomId = Math.random().toString(36).slice(2, 8)
    const socket = new WebSocket(WS_BASE + randomId)
    socket.addEventListener('open', () => {
      console.log('ws open')
      setWs(socket)
    })
  socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'state') {
          const payload = msg.payload
          if (payload && payload.id) playersRef.current[payload.id] = payload
        } else if (msg.type === 'snapshot') {
          // payload is an array of player states
          const arr = msg.payload || []
          playersRef.current = {}
          arr.forEach(p => { if (p && p.id) playersRef.current[p.id] = p })
        } else if (msg.type === 'join') {
          const p = msg.payload
          if (p && p.id) playersRef.current[p.id] = p
        } else if (msg.type === 'leave') {
          const id = msg.payload && msg.payload.id
          if (id && playersRef.current[id]) delete playersRef.current[id]
        }
      } catch (e) { }
    })

    let last = performance.now()
    let raf = null

    // helper: spawn bullet
    function spawnBullet(owner, fromHand = false) {
      const speedB = 480
      let sx, sy, angle
      if (owner === 'player') {
        // spawn from player's right hand if available
        sx = handPosPlayer.x || player.x
        sy = handPosPlayer.y || player.y
        angle = Math.atan2(mousePos.y - sy, mousePos.x - sx)
      } else {
        sx = handPosAI.x || ai.x
        sy = handPosAI.y || ai.y
        angle = Math.atan2(player.y - sy, player.x - sx)
      }
      bullets.push({ x: sx + Math.cos(angle) * 6, y: sy + Math.sin(angle) * 6, vx: Math.cos(angle) * speedB, vy: Math.sin(angle) * speedB, owner, ttl: 3, fromHand })
    }

    function update(now) {
      const dt = (now - last) / 1000
      last = now

  // movement (player)
      let dx = 0, dy = 0
      if (keys['w'] || keys['ArrowUp']) dy -= 1
      if (keys['s'] || keys['ArrowDown']) dy += 1
      if (keys['a'] || keys['ArrowLeft']) dx -= 1
      if (keys['d'] || keys['ArrowRight']) dx += 1
        if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1
        player.x += (dx/len) * speed * dt
        player.y += (dy/len) * speed * dt
        player.x = clamp(player.x, 0, canvas.width)
        player.y = clamp(player.y, 0, canvas.height)
        player.angle = Math.atan2(dy, dx)
        // send update
          if (socket && socket.readyState === WebSocket.OPEN) {
            const cid = socket.url.split('/').pop()
            player.id = cid
            socket.send(JSON.stringify({ type: 'update', payload: { id: cid, x: player.x, y: player.y, angle: player.angle } }))
          }
      }

      // pause handling
      if (!running) {
        raf = requestAnimationFrame(update)
        return
      }

      // player aim follows mouse
      player.angle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x)

      // AI simple behavior: aim at player, move slowly towards/away, fire when cooldown expires
      ai.angle = Math.atan2(player.y - ai.y, player.x - ai.x)
      // simple distance-based movement
      const dist = Math.hypot(player.x - ai.x, player.y - ai.y)
      if (dist > 220) {
        // move closer
        ai.x += Math.cos(ai.angle) * 60 * dt
        ai.y += Math.sin(ai.angle) * 60 * dt
      } else if (dist < 140) {
        // move away
        ai.x -= Math.cos(ai.angle) * 60 * dt
        ai.y -= Math.sin(ai.angle) * 60 * dt
      }
      // AI fire
      ai.cooldown -= dt
      if (ai.cooldown <= 0) {
        spawnBullet('ai')
        ai.cooldown = 0.8 + Math.random() * 1.0
      }

      // update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.ttl -= dt
        // offscreen
        if (b.ttl <= 0 || b.x < -20 || b.y < -20 || b.x > canvas.width + 20 || b.y > canvas.height + 20) {
          bullets.splice(i, 1)
          continue
        }
        // collisions
        if (b.owner === 'ai') {
          // hits player
          const d = Math.hypot(b.x - player.x, b.y - player.y)
          if (d < 14) {
              player.health -= 1
              bullets.splice(i, 1)
              continue
            }
        } else if (b.owner === 'player') {
          const d2 = Math.hypot(b.x - ai.x, b.y - ai.y)
          if (d2 < 14) {
            ai.health -= 1
            bullets.splice(i, 1)
              continue
          }
        }
      }

      // handle deaths and respawn
      if (player.health <= 0) {
        // player died: decrement score
        onScoreChange(-1)
        // respawn
        player.health = 5
        player.x = 400; player.y = 300
      }
      if (ai.health <= 0) {
        // AI died: increment score
        onScoreChange(1)
        ai.health = 5
        ai.x = Math.random() * (canvas.width - 200) + 100
        ai.y = Math.random() * (canvas.height - 200) + 100
      }

      // draw
      ctx.fillStyle = '#111'
      ctx.fillRect(0,0,canvas.width,canvas.height)

      // draw other players from network (if any) as characters
      const players = playersRef.current
      for (const id in players) {
        const p = players[id]
        const me = socket && socket.url && id === socket.url.split('/').pop()
        drawCharacter(ctx, p.x, p.y, p.angle || 0, id, 'sasuke', 0, me)
      }

      // draw AI as character; animate armProgress for firing
  const aiArmProgress = Math.min(1, Math.max(0, 1 - Math.max(0, ai.cooldown)))
  const aiHand = drawCharacter(ctx, ai.x, ai.y, ai.angle, 'ai', 'obito', aiArmProgress, false)
  if (aiHand) handPosAI = aiHand

      // draw bullets (with throwing-from-hand visual offset)
      for (const b of bullets) {
        ctx.fillStyle = b.owner === 'player' ? '#ffb86b' : '#f55'
        ctx.beginPath()
        if (b.fromHand) {
          ctx.arc(b.x, b.y - Math.sin((performance.now()/120) + b.x*0.01) * 2, 6, 0, Math.PI*2)
        } else {
          ctx.arc(b.x, b.y, 5, 0, Math.PI*2)
        }
        ctx.fill()
      }

      // draw local player on top as character; animate arm when throwing
      const armProgress = bullets.length > 0 ? 0.3 : 0 // simple proxy; could be per-throw timer
      let playerHand
      if (character === 'naruto' && narutoLoaded) {
        // draw naruto sprite centered and rotated
        ctx.save()
        ctx.translate(player.x, player.y - 6)
        ctx.rotate(player.angle)
        const w = 48, h = 96
        ctx.drawImage(narutoImg, -w/2, -h/2, w, h)
        ctx.restore()
        // approximate hand position in front
        playerHand = { x: player.x + Math.cos(player.angle) * 18, y: player.y + Math.sin(player.angle) * 18 }
      } else {
        playerHand = drawCharacter(ctx, player.x, player.y, player.angle, 'player', character, armProgress, true)
      }
      if (playerHand) handPosPlayer = playerHand

      // draw health bars
      function drawHealth(x, y, hp) {
        const w = 48
        const h = 6
        ctx.fillStyle = '#333'
        ctx.fillRect(x - w/2, y - 30, w, h)
        ctx.fillStyle = '#4caf50'
        ctx.fillRect(x - w/2, y - 30, (hp/5) * w, h)
        ctx.strokeStyle = '#000'
        ctx.strokeRect(x - w/2, y - 30, w, h)
      }
      drawHealth(player.x, player.y, player.health)
      drawHealth(ai.x, ai.y, ai.health)

      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      if (raf) cancelAnimationFrame(raf)
      try { socket.close() } catch(e){}
    }
  }, [running, resetCounter, character])

  return (
    <div>
      <canvas ref={canvasRef} style={{ border: '1px solid #444' }} />
      <p>Use WASD or arrow keys to move. This is a prototype; other players' positions are shown if connected.</p>
    </div>
  )
}
