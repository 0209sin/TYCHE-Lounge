import { useState, useEffect } from 'react';
import { WHEEL_SLOTS, type WheelSlot } from './catalog';
import { Sparkles, Gift, Clock, Loader2 } from 'lucide-react';

interface DailyWheelProps {
  lastSpinTime: number;
  available: boolean;
  onSpin: (slotIndex: number) => Promise<void>;
  onSuccess: (slot: WheelSlot) => void;
  soundEnabled: boolean;
}

export default function DailyWheel({
  lastSpinTime,
  available,
  onSpin,
  onSuccess,
}: DailyWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [canSpin, setCanSpin] = useState(false);

  // Check cooldown: 24h
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = 24 * 60 * 60 * 1000 - (now - lastSpinTime);
      if (diff <= 0 || lastSpinTime === 0) {
        setCanSpin(true);
        setTimeLeft('');
      } else {
        setCanSpin(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastSpinTime]);

  const handleSpin = async () => {
    if (spinning || !canSpin || !available) return;
    setSpinning(true);

    // Pick winning slot with crypto RNG
    const randArr = new Uint32Array(1);
    crypto.getRandomValues(randArr);
    const winningIndex = randArr[0] % WHEEL_SLOTS.length;
    const targetSlot = WHEEL_SLOTS[winningIndex];

    const sliceAngle = 360 / WHEEL_SLOTS.length;
    // Align slot to top indicator (270 degrees in SVG circle or top pointer)
    const extraRotations = 5 * 360;
    // Calculate final angle so pointer at top points to winningIndex
    // Segment i spans [i * sliceAngle, (i + 1) * sliceAngle]. Midpoint is (i + 0.5) * sliceAngle
    const targetAngle = 360 - (winningIndex * sliceAngle + sliceAngle / 2);
    const finalRotation = rotation + extraRotations + (targetAngle - (rotation % 360) + 360) % 360;

    setRotation(finalRotation);

    try {
      // Allow wheel animation to run (4 seconds)
      await new Promise(r => setTimeout(r, 4200));
      await onSpin(winningIndex);
      onSuccess(targetSlot);
    } finally {
      setSpinning(false);
    }
  };

  const sliceAngle = 360 / WHEEL_SLOTS.length;

  return (
    <div className="wheel-container">
      <div className="wheel-card">
        <div className="wheel-header">
          <div className="wheel-title-badge">
            <Sparkles size={16} />
            <span>DAILY LUCKY WHEEL</span>
          </div>
          <h2>행운의 일일 룰렛</h2>
          <p>매일 24시간마다 1회 무료 회전! 최대 1만 코인 잭팟의 주인공이 되어보세요.</p>
        </div>

        <div className="wheel-stage">
          {/* Top Indicator / Pointer */}
          <div className="wheel-pointer-wrap">
            <div className="wheel-pointer" />
          </div>

          {/* Wheel Disc */}
          <div
            className="wheel-disc"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 360 360" className="wheel-svg">
              <defs>
                <filter id="wheel-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {WHEEL_SLOTS.map((slot, index) => {
                const startAngle = index * sliceAngle;
                const endAngle = (index + 1) * sliceAngle;
                const r = 175;
                const cx = 180;
                const cy = 180;

                // Arc coordinates
                const x1 = cx + r * Math.cos((Math.PI * (startAngle - 90)) / 180);
                const y1 = cy + r * Math.sin((Math.PI * (startAngle - 90)) / 180);
                const x2 = cx + r * Math.cos((Math.PI * (endAngle - 90)) / 180);
                const y2 = cy + r * Math.sin((Math.PI * (endAngle - 90)) / 180);

                const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
                const textAngle = startAngle + sliceAngle / 2;

                return (
                  <g key={slot.id}>
                    <path d={d} fill={slot.color} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                    <text
                      x={cx}
                      y={cy - 110}
                      fill={slot.textColor}
                      fontSize="13"
                      fontWeight="800"
                      textAnchor="middle"
                      transform={`rotate(${textAngle}, ${cx}, ${cy})`}
                      style={{ letterSpacing: '0.02em', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}
                    >
                      {slot.label}
                    </text>
                  </g>
                );
              })}
              {/* Outer decorative ring */}
              <circle cx="180" cy="180" r="176" fill="none" stroke="rgba(255, 209, 92, 0.4)" strokeWidth="3" />
            </svg>

            {/* Center Cap */}
            <div className="wheel-center-cap">
              <Gift size={24} style={{ color: '#ffd15c' }} />
            </div>
          </div>
        </div>

        {/* Spin Action Section */}
        <div className="wheel-footer">
          {canSpin ? (
            <button
              className="primary-button spin-action-btn"
              disabled={spinning || !available}
              onClick={() => void handleSpin()}
            >
              {spinning ? (
                <>
                  <Loader2 className="spin" size={20} />
                  회전 중... 행운을 비세요!
                </>
              ) : (
                <>
                  <Gift size={20} />
                  무료 행운 룰렛 돌리기
                </>
              )}
            </button>
          ) : (
            <div className="wheel-cooldown-badge">
              <Clock size={18} />
              <span>다음 무료 룰렛까지: <b>{timeLeft}</b></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
