import './index.css'
import AnimatedBackground from './components/AnimatedBackground'
import Header from './components/Header'
import Hero from './components/Hero'
import ProfilesSection from './components/ProfilesSection'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Pricing from './components/Pricing'
import CTABanner from './components/CTABanner'
import Footer from './components/Footer'
import StickyButtons from './components/StickyButtons'

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 110% 55% at 50% -5%, rgba(29,110,85,0.22) 0%, transparent 55%),
        #131815
      `,
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <AnimatedBackground />
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <Hero />
          <ProfilesSection />
          <Features />
          <HowItWorks />
          <Pricing />
          <CTABanner />
        </main>
        <Footer />
        <StickyButtons />
      </div>
    </div>
  )
}
