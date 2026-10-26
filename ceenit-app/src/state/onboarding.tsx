import { createContext, ReactNode, useContext, useState } from 'react';

// Holds what the seller has typed during sign up. Kept in memory only for now.
// The real version will send this to the backend at the end of sign up.
type Onboarding = {
  method: 'phone' | 'email';
  contact: string;
  fullName: string;
  shopName: string;
  category: string;
  city: string;
  linkName: string;
  wallet: string;
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
