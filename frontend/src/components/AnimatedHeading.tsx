
'use client'

import React from 'react';
import dynamic from 'next/dynamic';

const AnimatedHeading = () => {
    const MotionHeading = dynamic(() => import('framer-motion').then((m) => m.motion.h1), {
        ssr: false,
    });

    return (
        <MotionHeading
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white"
        >
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">Twin Suns</span>
        </MotionHeading>
    );
};

export default AnimatedHeading;

