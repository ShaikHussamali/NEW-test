import React, { useState } from 'react'
import GameCanvas from './game/GameCanvas'

const CHARACTERS = [
  { id: 'naruto', name: 'Naruto', color: '#ffcc00', emoji: '🍥' },
  { id: 'sasuke', name: 'Sasuke', color: '#334', emoji: '🗡️' },
  { id: 'kakashi', name: 'Kakashi', color: '#bbb', emoji: '📚' },
  { id: 'obito', name: 'Obito', color: '#800', emoji: '👺' }
]

export default function App() {
  const [selected, setSelected] = useState(CHARACTERS[0].id)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [resetCounter, setResetCounter] = useState(0)

  function handleScoreChange(delta) {
    setScore(s => s + delta)
  }

  function handleReset() {
    setScore(0)
    setResetCounter(c => c + 1)
    setRunning(false)
  }

  return (
    <div className="app">
      <h1>NEW-test Action Game (Prototype)</h1>

      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
        <div>
          <strong>Choose character:</strong>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            {CHARACTERS.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelected(ch.id)}
                style={{padding:8, border: selected===ch.id ? '2px solid #0cf' : '1px solid #444', background: selected===ch.id ? ch.color : '#222', color:'#fff', cursor:'pointer'}}
              >{ch.emoji} {ch.name}</button>
            ))}
          </div>
        </div>

        <div style={{marginLeft:'auto'}}>
          <strong>Score:</strong> <span style={{fontSize:18, marginLeft:8}}>{score}</span>
        </div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button onClick={() => setRunning(r => !r)} style={{padding:'8px 12px'}}>{running ? 'Pause' : 'Play'}</button>
        <button onClick={() => { setRunning(true) ; setResetCounter(c => c + 1) }} style={{padding:'8px 12px'}}>Start Game</button>
        <button onClick={handleReset} style={{padding:'8px 12px'}}>Reset Game</button>
      </div>

      <GameCanvas
        character={selected}
        running={running}
        resetCounter={resetCounter}
        onScoreChange={handleScoreChange}
      />
    </div>
  )
}
