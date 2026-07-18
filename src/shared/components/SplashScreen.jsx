import { useState, useEffect } from 'react'
import './SplashScreen.css'

export default function SplashScreen({ onFinish }) {
  const [state, setState] = useState('visible')

  useEffect(() => {
    const fadeTimer = setTimeout(() => setState('fading'), 4000)
    return () => clearTimeout(fadeTimer)
  }, [])

  useEffect(() => {
    if (state === 'fading') {
      const removeTimer = setTimeout(() => onFinish(), 500)
      return () => clearTimeout(removeTimer)
    }
  }, [state, onFinish])

  return (
    <div className={`splash splash--${state}`}>
      <div className="splash-content">
        <svg className="splash-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="splash-scissor">
            <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="30" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12.5 12.5L30 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M27.5 12.5L10 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="20" cy="20" r="2" fill="currentColor" stroke="currentColor" strokeWidth="1" />
          </g>
        </svg>
        <h1 className="splash-title">TailorOps</h1>
        <p className="splash-tagline">
          A service by <span className="gradient-text">Liberal Tech</span>
        </p>
      </div>
    </div>
  )
}
