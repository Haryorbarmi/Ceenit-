import { createContext, ReactNode, useContext, useState } from 'react';

// Holds what the seller has typed during sign up. It is sent to the API when they finish the PIN step.
type Onboarding = {
  method: 'phone' | 'email';
  contact: string;
  fullName: string;
  shopName: string;
  category: string;
  city: string;
  linkName: string;
  wallet: string;
  /** The login code, shown on screen only when the API is in development and has no WhatsApp sender yet. */
  devCode: string;
};

const initial: Onboarding = {
  method: 'phone',
  contact: '',
  fullName: '',
  shopName: '',
  category: 'Cars',
  city: 'Lagos, Nigeria',
  linkName: '',
  wallet: '',
  devCode: '',
};

type Ctx = { data: Onboarding; update: (patch: Partial<Onboarding>) => void };
const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Onboarding>(initial);
  const update = (patch: Partial<Onboarding>) => setData((d) => ({ ...d, ...patch }));
  return <OnboardingContext.Provider value={{ data, update }}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
