export default function Header() {
  return (
    <header style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      zIndex: 50,
      padding: '24px 32px',
    }}>
      <a
        href="#"
        onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        style={{ textDecoration: 'none' }}
      >
        <span style={{
          fontSize: 22, fontWeight: 700, color: '#FFFFFF',
          letterSpacing: '-0.02em',
          fontFamily: 'Satoshi, system-ui, sans-serif',
        }}>Prospix</span>
      </a>
    </header>
  )
}
