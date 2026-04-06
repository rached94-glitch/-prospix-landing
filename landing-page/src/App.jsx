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

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0D', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <AnimatedBackground />
      <div style={{ position: 'relative', zIndex: 1, display: 'contents' }}>
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
      </div>
    </div>
  )
}
