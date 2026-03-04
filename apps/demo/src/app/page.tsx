import { Footer } from "@/components/landing/Footer"
import { Hero } from "@/components/landing/Hero"
import { NavHeader } from "@/components/landing/NavHeader"
import { TheProblem } from "@/components/landing/TheProblem"
import { WhyStarknet } from "@/components/landing/WhyStarknet"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { PlaygroundSection } from "@/components/interactive/PlaygroundSection"
import { PipelineSection } from "@/components/interactive/PipelineSection"
import { AccountDeploySection } from "@/components/interactive/AccountDeploySection"
import { ScrollReveal } from "@/components/ScrollReveal"

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <NavHeader />
      <Hero />
      <ScrollReveal>
        <TheProblem />
      </ScrollReveal>
      <ScrollReveal>
        <WhyStarknet />
      </ScrollReveal>
      <ScrollReveal>
        <PerformanceStats />
      </ScrollReveal>
      <ScrollReveal>
        <PlaygroundSection />
      </ScrollReveal>
      <ScrollReveal>
        <PipelineSection />
      </ScrollReveal>
      <ScrollReveal>
        <AccountDeploySection />
      </ScrollReveal>
      <Footer />
    </main>
  )
}
