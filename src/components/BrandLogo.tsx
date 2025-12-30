// React import removed as potentially unused


// THE OFFICIAL LOGO: Boss Directing (chosen by user)
export const LogoBossDirecting = ({ className = "w-12 h-12" }: { className?: string }) => (
    <div className={`relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#4f46e5', stopOpacity: 1 }} /> {/* Indigo */}
                    <stop offset="100%" style={{ stopColor: '#9333ea', stopOpacity: 1 }} /> {/* Purple */}
                </linearGradient>
            </defs>
            {/* Store Awning/Background */}
            <path d="M15 40 L25 20 L75 20 L85 40 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
            <path d="M20 40 V 90 H 80 V 40" stroke="#cbd5e1" strokeWidth="3" fill="none" />

            {/* Boss Figure */}
            <circle cx="50" cy="50" r="10" fill="url(#bossGrad)" /> {/* Head */}
            <path d="M30 90 Q 30 70 50 70 Q 70 70 70 90" fill="url(#bossGrad)" /> {/* Body Base */}

            {/* Directing Arms - Commanding gesture */}
            <path d="M35 75 L 20 60" stroke="url(#bossGrad)" strokeWidth="6" strokeLinecap="round" /> {/* Left arm pointing down/out */}
            <path d="M65 75 L 85 55" stroke="url(#bossGrad)" strokeWidth="6" strokeLinecap="round" /> {/* Right arm pointing up/directing */}
        </svg>
    </div>
);
