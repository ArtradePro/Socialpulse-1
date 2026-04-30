import React, { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PlanCard from './PlanCard';

interface Props {
  open: boolean;
  onClose: () => void;
  plans: any[];
  onDone?: () => void;
}

export default function UpgradeModal({ open, onClose, plans, onDone }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const upgrade = async (key: string) => {
    setLoading(key);
    try {
      await api.post('/billing/plan', { plan: key });
      toast.success(`Plan updated to ${plans.find(p => p.key === key)?.name}`);
      onDone?.();
      onClose();
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setLoading(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Choose a Plan</h2>
            <p className="text-gray-400 text-sm">Upgrade to unlock more features</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(p => (
            <PlanCard
              key={p.key}
              plan={p}
              onUpgrade={p.current ? undefined : () => upgrade(p.key)}
              loading={loading === p.key}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
