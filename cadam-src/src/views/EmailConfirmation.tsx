import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

function EmailConfirmation() {
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('pendingSignupEmail');

    if (storedEmail) {
      setEmail(storedEmail);
      sessionStorage.removeItem('pendingSignupEmail');
    } else {
      setShowEmailInput(true);
    }
  }, []);

  const handleResend = async () => {
    const emailToResend = email.trim();

    if (!emailToResend) {
      toast({
        title: 'Whoopsies',
        description: 'Enter your email address to resend verification.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
      });

      if (error) throw error;

      toast({
        title: 'Email Sent!',
        description: "We've sent another verification email to your inbox.",
      });
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast({
        title: 'Whoopsies',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to resend verification email',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-adam-bg-secondary-dark p-8 shadow-md">
          {/* Icon and Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-adam-neutral-800">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h1 className="mb-4 text-2xl font-semibold text-white">
              Check Your Email
            </h1>
            <p className="text-gray-400">
              We've sent a verification link to{' '}
              <span className="text-white">{email || 'your email'}</span>. Click
              the link to verify your account.
            </p>
            <p className="mt-2 text-center text-gray-400">
              (Make sure to check your spam folder)
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-6">
            {showEmailInput && (
              <div className="space-y-2">
                <Label htmlFor="resend-email" className="text-white">
                  Email
                </Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="border-gray-700 bg-adam-bg-dark px-4 text-white placeholder:text-gray-400 max-[430px]:text-base"
                />
              </div>
            )}

            {/* Alert for spam warning and sign in link */}
            <Alert className="border-adam-neutral-700 bg-adam-neutral-800">
              <AlertDescription className="text-center text-gray-400">
                Already verified your email?{' '}
                <Link
                  to="/signin"
                  className="font-medium text-adam-text-primary transition-colors duration-200 hover:text-adam-text-primary/80"
                >
                  Sign in here
                </Link>
              </AlertDescription>
            </Alert>

            {/* Resend Email button */}
            <Button
              type="button"
              className="w-full p-6 text-adam-blue transition-colors duration-200 hover:bg-adam-neutral-950 hover:text-adam-blue/80"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailConfirmation;
