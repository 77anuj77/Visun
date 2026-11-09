import { LivingHero } from "@/components/marketing/landing/LivingHero";
import { ChaosToClarity } from "@/components/marketing/landing/ChaosToClarity";
import { WorkspaceReveal } from "@/components/marketing/landing/WorkspaceReveal";
import { VoiceScene } from "@/components/marketing/landing/VoiceScene";
import { StickerUniverse } from "@/components/marketing/landing/StickerUniverse";
import { ApprovalSequence } from "@/components/marketing/landing/ApprovalSequence";
import { PrivateInstall } from "@/components/marketing/landing/PrivateInstall";
import { InstallJourney } from "@/components/marketing/landing/InstallJourney";
import { FinalScene } from "@/components/marketing/landing/FinalScene";

export default function LandingPage() {
  return (
    <div className="mk-landing">
      <LivingHero />
      <ChaosToClarity />
      <WorkspaceReveal />
      <VoiceScene />
      <StickerUniverse />
      <ApprovalSequence />
      <PrivateInstall />
      <InstallJourney />
      <FinalScene />
    </div>
  );
}
