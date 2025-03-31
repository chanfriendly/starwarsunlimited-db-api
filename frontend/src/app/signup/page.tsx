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
import { AlertTriangle, Check } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
    const router = useRouter();
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Handle form input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Clear errors when user types
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Validate form inputs
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        // Username validation
        if (!formData.username) {
            newErrors.username = "Username is required";
        } else if (formData.username.length < 3) {
            newErrors.username = "Username must be at least 3 characters";
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username = "Username can only contain letters, numbers, and underscores";
        }
        
        // Email validation
        if (!formData.email) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }
        
        // Password validation
        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
        }
        
        // Confirm password validation
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        setIsLoading(true);
        
        try {
            await register(formData.username, formData.email, formData.password);
            
            // Show success message
            setSuccess(true);
            
            // Redirect to login page after a short delay
            setTimeout(() => {
                router.push('/login');
            }, 2000);
            
        } catch (err: any) {
            console.error("Signup error:", err);
            setServerError(err.message || "An unexpected error occurred during signup");
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
                            Create Your Account
                        </span>
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-center">
                        Join the Star Wars Unlimited community and start building decks
                    </CardDescription>
                </CardHeader>
                
                <CardContent>
                    {/* Success message */}
                    {success && (
                        <Alert className="mb-6 bg-green-900/30 border-green-800 text-green-300">
                            <Check className="h-4 w-4" />
                            <AlertTitle>Success!</AlertTitle>
                            <AlertDescription>
                                Your account has been created. Redirecting to login...
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {/* Error message */}
                    {serverError && (
                        <Alert className="mb-6 bg-red-900/30 border-red-800 text-red-300">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Registration Failed</AlertTitle>
                            <AlertDescription>{serverError}</AlertDescription>
                        </Alert>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username field */}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="Enter your username"
                                value={formData.username}
                                onChange={handleChange}
                                className={`bg-gray-800 border ${errors.username ? 'border-red-500' : 'border-gray-700'}`}
                                disabled={isLoading || success}
                            />
                            {errors.username && (
                                <p className="text-red-500 text-sm">{errors.username}</p>
                            )}
                        </div>
                        
                        {/* Email field */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`bg-gray-800 border ${errors.email ? 'border-red-500' : 'border-gray-700'}`}
                                disabled={isLoading || success}
                            />
                            {errors.email && (
                                <p className="text-red-500 text-sm">{errors.email}</p>
                            )}
                        </div>
                        
                        {/* Password field */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChange={handleChange}
                                className={`bg-gray-800 border ${errors.password ? 'border-red-500' : 'border-gray-700'}`}
                                disabled={isLoading || success}
                            />
                            {errors.password && (
                                <p className="text-red-500 text-sm">{errors.password}</p>
                            )}
                        </div>
                        
                        {/* Confirm Password field */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className={`bg-gray-800 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-700'}`}
                                disabled={isLoading || success}
                            />
                            {errors.confirmPassword && (
                                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
                            )}
                        </div>
                        
                        <Button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={isLoading || success}
                        >
                            {isLoading ? 'Creating Account...' : 'Sign Up'}
                        </Button>
                    </form>
                </CardContent>
                
                <CardFooter className="flex justify-center">
                    <p className="text-gray-400">
                        Already have an account?{' '}
                        <Link href="/login" className="text-purple-400 hover:underline">
                            Log In
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}