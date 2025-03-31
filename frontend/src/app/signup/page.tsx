// frontend/src/app/signup/page.tsx
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
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
    const router = useRouter();
    const { register } = useAuth();
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
            await register(username, email, password);
            
            // Signup successful
            setSuccess(true);
            // Redirect after a delay
            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (err: any) {
            console.error("Signup error:", err);
            setError(err.message || "An unexpected error occurred during signup.");
        } finally {
            setIsLoading(false);
        }
    };

    // Rest of component remains the same...
}