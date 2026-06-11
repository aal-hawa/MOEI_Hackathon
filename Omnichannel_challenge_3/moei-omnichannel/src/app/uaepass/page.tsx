'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Smartphone, Fingerprint, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MockUAEPASSRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/customer';

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setStep(2);
      setIsLoading(false);
    }, 1500);
  };

  const handleConfirm = () => {
    setIsLoading(true);
    // Simulate setting auth cookie/state
    setTimeout(() => {
      window.location.href = returnUrl;
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-green-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-green-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
            <Fingerprint className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-900">UAE PASS</CardTitle>
          <CardDescription>
            {step === 1 ? 'Enter your Emirates ID or Phone Number' : 'Confirm login on your mobile app'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="e.g., 784-XXXX-XXXXXXX-X or 050XXXXXXX"
                  className="h-12 text-center text-lg border-green-200 focus-visible:ring-green-600"
                />
              </div>
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Login'}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <div className="relative">
                <Smartphone className="w-24 h-24 text-green-600 animate-pulse" />
                <Shield className="w-8 h-8 text-green-500 absolute -bottom-2 -right-2 bg-white rounded-full" />
              </div>
              <p className="text-center text-green-800 font-medium">
                A request has been sent to your UAE PASS app.
              </p>
              <Button
                onClick={handleConfirm}
                disabled={isLoading}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 mt-4"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Simulate App Confirmation'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
