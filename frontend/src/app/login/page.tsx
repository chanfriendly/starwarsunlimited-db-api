// frontend/src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectPath = searchParams.get('redirect') || '/profile';
    
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username || !password) {
            setError("Please enter both username and password");
            return;
        }

        setIsLoading(true);

        try {
            await login(username, password);
            
            // Redirect to the requested page or profile
            router.push(redirectPath);
            
        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || "Invalid username or password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
            <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">
                        <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                            Welcome Back
                        </span>
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-center">
                        Sign in to your account to access your decks and collection
                    </CardDescription>
                </CardHeader>
                
                <CardContent>
                    {error && (
                        <Alert className="mb-6 bg-red-900/30 border-red-800 text-red-300">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Login Failed</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="bg-gray-800 border border-gray-700"
                                disabled={isLoading}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-gray-800 border border-gray-700"
                                disabled={isLoading}
                            />
                        </div>
                        
                        <Button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
                
                <CardFooter className="flex justify-center">
                    <p className="text-gray-400">
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-purple-400 hover:underline">
                            Sign Up
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}