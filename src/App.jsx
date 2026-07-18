import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tailorops-theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tailorops-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="logo">
          <span className="logo-tag" />
          TailorOps
        </div>
        <div className="nav-right">
          <div className="nav-links">
            <a href="#features">Modules</a>
            <a href="#tenancy">Multi-shop</a>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
          </button>
          <a href="#" className="btn-ghost">Sign in</a>
          <a href="#" className="btn-primary">Create shop account →</a>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">
            <span className="eyebrow-rule" />
            TAILOR SHOP MANAGEMENT
          </div>
          <h1>
            Run the whole shop.<br />
            <span className="gradient-text">One thread at a time.</span>
          </h1>
          <p className="hero-sub">
            Order booking, measurements, production, and payments — tracked from the
            first pin to the final press. Built for tailoring houses who'd rather
            cut fabric than chase paperwork.
          </p>
          <div className="hero-ctas">
            <a href="#" className="btn-primary">Create shop →</a>
            <a href="#features" className="btn-secondary">See how it runs</a>
          </div>
        </div>
      </section>

      <section className="pipeline">
        <div className="wrap">
          <div className="pipeline-label mono">Every order, tagged and tracked —</div>
          <div className="thread-track">
            <div className="thread-line" />
            {['BOOKED', 'CUTTING', 'STITCHING', 'READY', 'DELIVERED'].map((stage, i) => (
              <div key={stage} className={`tag ${i === 2 ? 'active' : ''}`}>
                <div className="tag-shape">
                  <div className="tag-hole" />
                  <span className="tag-num mono">{`0${i + 1}`}</span>
                  <span className="tag-name mono">{stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="docket wrap">
        <div className="docket-item">
          <div className="docket-num serif">5</div>
          <div className="docket-desc">production stages tracked automatically, from booking to delivery.</div>
        </div>
        <div className="docket-item">
          <div className="docket-num serif">1</div>
          <div className="docket-desc">order record holds the customer, measurements, tailor, and balance together.</div>
        </div>
        <div className="docket-item">
          <div className="docket-num serif">∞</div>
          <div className="docket-desc">shops on one account, each with its own customers, staff, and books.</div>
        </div>
      </section>

      <section className="section wrap" id="features">
        <div className="section-head">
          <div className="section-eyebrow mono">The modules</div>
          <h2 className="section-title serif">Everything a tailoring floor needs, nothing it doesn't.</h2>
          <p className="section-sub">Each module does one job well, and they hand work to each other automatically.</p>
        </div>
        <div className="feature-grid">
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">CUSTOMER</span>
            <h3 className="serif">Customer master</h3>
            <p>Every regular's contact details and measurement history, one search away.</p>
          </div>
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">ORDERS</span>
            <h3 className="serif">Order booking</h3>
            <p>Garment, quantity, rate, and delivery date captured in one clean docket.</p>
          </div>
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">MEASURE</span>
            <h3 className="serif">Measurements</h3>
            <p>Chest to pancha, saved per customer and reused on every future order.</p>
          </div>
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">FLOOR</span>
            <h3 className="serif">Production tracking</h3>
            <p>Move an order from Booked to Delivered with one tap — no lost dockets.</p>
          </div>
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">LEDGER</span>
            <h3 className="serif">Payments &amp; balance</h3>
            <p>Advance, balance, and history, always accurate, never manually tallied.</p>
          </div>
          <div className="fcard">
            <div className="tag-hole" />
            <span className="fcard-index mono">REPORTS</span>
            <h3 className="serif">Reports</h3>
            <p>Pending orders, deliveries, tailor work, and profit — ready when you are.</p>
          </div>
        </div>
      </section>

      <section className="band" id="tenancy">
        <div className="wrap">
          <div className="band-grid">
            <div>
              <div className="section-eyebrow mono">Built for one shop. Ready for many.</div>
              <h2 className="section-title serif">Every shop gets its own spool.</h2>
              <p className="section-sub">
                One account can run several branches or franchise shops — each with
                its own customers, tailors, and books, fully separate from the rest.
                Nothing crosses threads.
              </p>
            </div>
            <div className="spools">
              {['Shop A', 'Shop B', 'Shop C', 'Shop D'].map((s, i) => (
                <div key={s} className={`spool s${i + 1}`}>
                  <span className="spool-label mono">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="cta wrap">
        <h2 className="serif">
          Stop chasing paper.<br />
          <span className="gradient-text">Start tracking thread.</span>
        </h2>
        <p>Set up your shop in a few minutes — no spreadsheets required.</p>
        <a href="#" className="btn-primary">Create shop account →</a>
      </section>

      <footer className="footer wrap">
        <span>© 2026 TailorOps</span>
        <span className="footer-service">
          A service by <span className="gradient-text">Liberal Tech</span>
        </span>
        <span className="mono">BOOKED · CUTTING · STITCHING · READY · DELIVERED</span>
      </footer>
    </div>
  )
}

export default App
