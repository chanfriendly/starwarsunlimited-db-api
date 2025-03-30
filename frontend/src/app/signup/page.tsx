// src/app/signup/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Terminal } from "lucide-react";

export default function SignupPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!username || !email || !password) {
            setError("Please fill in all fields.");
            return;
        }

        setIsLoading(true);

        try {
            // IMPORTANT: Replace with your actual API endpoint URL
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Assuming the backend sends error details in 'detail'
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }

            // Signup successful
            setSuccess(true);
            // Optionally redirect after a delay or prompt user
            setTimeout(() => {
                router.push('/login');
            }, 2000); // Redirect to login after 2 seconds

        } catch (err: any) {
            console.error("Signup error:", err);
            setError(err.message || "An unexpected error occurred during signup.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
            <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold twin-suns-gradient">Create Account</CardTitle>
                    <CardDescription className="text-gray-400">
                        Join the Twin Suns community!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignup} className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="bg-red-900/30 border-red-700 text-red-300">
                                <AlertTriangle className="h-4 w-4 !text-red-400" />
                                <AlertTitle>Signup Failed</AlertTitle>
                                <AlertDescription>
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}
                        {success && (
                             <Alert variant="default" className="bg-green-900/30 border-green-700 text-green-300">
                                <Terminal className="h-4 w-4 !text-green-400" />
                                <AlertTitle>Success!</AlertTitle>
                                <AlertDescription>
                                    Account created successfully. Redirecting to login...
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="GalacticGamer77"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="bg-gray-800 border-gray-700 focus:border-purple-500 focus:ring-purple-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-gray-800 border-gray-700 focus:border-purple-500 focus:ring-purple-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="********"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-gray-800 border-gray-700 focus:border-purple-500 focus:ring-purple-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                placeholder="********"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="bg-gray-800 border-gray-700 focus:border-purple-500 focus:ring-purple-500"
                            />
                        </div>
                        {/* Privacy Policy/Data Usage Notice */}
                        <div className="text-xs text-gray-500 pt-2">
                            By creating an account, you agree to our Terms of Service and Privacy Policy.
                            We use anonymized deck data to improve our deck recommendation tools.
                            {/* Add links to actual policy pages here */}
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Creating Account...' : 'Sign Up'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="text-center text-sm text-gray-400">
                    Already have an account?{' '}
                    <Link href="/login" className="text-purple-400 hover:underline ml-1">
                        Log In
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}