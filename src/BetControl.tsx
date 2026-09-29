import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MIN_BET, MAX_BET } from './catalog';

type BetControlProps = {
  bet: number;
  onChangeBet: (val: number) => void;
  balance: number;
  disabled?: boolean;
  quickPresets?: number[];
  label?: string;
  showMaxButton?: boolean;
};

export default function BetControl({
  bet,
  onChangeBet,
  balance,
  disabled = false,
  quickPresets = [100, 500, 1000, 5000, 10000],
  label,
  showMaxButton = true,
}: BetControlProps) {
  const [betInput, setBetInput] = useState<string>('');

  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const maxAffordable = Math.min(MAX_BET, Math.max(0, balance));

  const handleMinus = () => {
    setBetInput('');
    const step = bet > 5000 ? 1000 : bet > 1000 ? 500 : bet > 100 ? 100 : 10;
    const next = Math.max(MIN_BET, bet - step);
    onChangeBet(next);
  };

  const handlePlus = () => {
    setBetInput('');
    const step = bet >= 5000 ? 1000 : bet >= 1000 ? 500 : bet >= 100 ? 100 : 10;
    const next = Math.min(maxAffordable > 0 ? maxAffordable : MAX_BET, bet + step);
    onChangeBet(next);
  };

  const handleMax = () => {
    setBetInput('');
    if (maxAffordable >= MIN_BET) {
      onChangeBet(maxAffordable);
    }
  };

  return (
    <div className="bet-input-component">
      {label && (
        <div className="bet-component-header">
          <span>{label}</span>
          <span className="bet-balance-hint">보유: {fmt(balance)} 코인</span>
        </div>
      )}

      <div className="bet-control custom-bet-control">
        <button
          type="button"
          disabled={disabled || bet <= MIN_BET}
          onClick={handleMinus}
          title="배팅액 감소"
          aria-label="배팅액 감소"
        >
          <Minus size={16} />
        </button>

        <div className="bet-input-wrapper">
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={betInput !== '' ? betInput : fmt(bet)}
            onFocus={e => {
              setBetInput(String(bet));
              e.target.select();
            }}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setBetInput(val);
              const num = parseInt(val, 10);
              if (!isNaN(num) && num > 0) {
                onChangeBet(num);
              }
            }}
            onBlur={() => {
              setBetInput('');
              const limit = maxAffordable > 0 ? maxAffordable : MIN_BET;
              const clamped = Math.max(MIN_BET, Math.min(MAX_BET, Math.min(limit, bet)));
              onChangeBet(clamped);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="bet-custom-input"
            placeholder="직접 입력"
            title="원하는 배팅 금액을 직접 숫자로 입력할 수 있습니다"
          />
          <span className="bet-input-unit">코인</span>
        </div>

        <button
          type="button"
          disabled={disabled || (maxAffordable > 0 && bet >= maxAffordable)}
          onClick={handlePlus}
          title="배팅액 증가"
          aria-label="배팅액 증가"
        >
          <Plus size={16} />
        </button>

        {showMaxButton && (
          <button
            type="button"
            className="bet-max-chip"
            disabled={disabled || balance < MIN_BET}
            onClick={handleMax}
            title="보유 코인 전액 배팅"
          >
            최대
          </button>
        )}
      </div>

      {quickPresets && quickPresets.length > 0 && (
        <div className="quick-bets">
          {quickPresets.map(b => (
            <button
              key={b}
              type="button"
              disabled={disabled}
              className={bet === b ? 'selected' : ''}
              onClick={() => {
                setBetInput('');
                onChangeBet(b);
              }}
            >
              {fmt(b)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
