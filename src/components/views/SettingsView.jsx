'use client';

import { memo, useState } from 'react';
import { Trash2, Building2 } from 'lucide-react';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { positiveNumber, validate, hasErrors } from '@/utils/formValidation';

function SettingsView({
  settings,
  onUpdateBaseRate,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  error,
  onRetry
}) {
  const [newPm, setNewPm] = useState('');
  const [rateInput, setRateInput] = useState(settings.defaultDollarRate);
  const [rateError, setRateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleRateUpdate = (e) => {
    e.preventDefault();
    const errors = validate({ rate: rateInput }, { rate: positiveNumber('Rate must be greater than 0') });
    if (hasErrors(errors)) {
      setRateError(errors.rate);
      return;
    }
    setRateError('');
    onUpdateBaseRate(Number(rateInput));
  };

  const handlePmAdd = (e) => {
    e.preventDefault();
    if (!newPm.trim()) return;
    onAddPaymentMethod(newPm.trim());
    setNewPm('');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl" id="settings-view">
      <ErrorBanner error={error} onRetry={onRetry} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ERP System Settings</h1>
        <p className="text-sm text-slate-500 font-medium">Configure Exchange Rates, Income Channels, and Audit Access Controls.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Column 1: Exchange Rates & Company Info */}
        <div className="space-y-6">

          {/* Exchange Rates Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Base Dollar Rate</h3>
            <form onSubmit={handleRateUpdate} className="flex gap-3 items-end" id="form-update-rate">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">Standard Exchange Rate (BDT/USD)</label>
                <div className="relative">
                    <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => { setRateInput(Number(e.target.value)); if (rateError) setRateError(''); }}
                    className="w-full text-xs font-bold pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">৳</span>
                </div>
                {rateError && <p className="mt-1 text-[10px] font-semibold text-rose-500">{rateError}</p>}
              </div>
              <button
                type="submit"
                className="bg-brand-blue text-white text-xs font-bold px-4 py-2 rounded-xl h-9 hover:bg-[#154673]"
              >
                Update Base Rate
              </button>
            </form>
          </div>

          {/* Company details */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Corporate Identity</h3>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Building2 className="text-brand-blue" size={20} />
              <div>
                <p className="text-xs font-bold text-slate-950">AdsBuzz Ltd</p>
                <p className="text-[10px] text-slate-400">Primary Office: Dhaka, Bangladesh</p>
              </div>
            </div>
          </div>

        </div>

        {/* Column 2: Payment Gateway Management */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configured Payment Methods</h3>
            <p className="text-[10px] text-slate-400 mt-1">Add or delete active receiving bank accounts or mobile wallet numbers.</p>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {settings.paymentMethods.map(pm => (
              <div key={pm} className="p-2.5 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">{pm}</span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(pm)}
                  aria-label={`Delete payment method ${pm}`}
                  className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5 rounded hover:bg-slate-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handlePmAdd} className="flex gap-2" id="form-add-pm">
            <input
              type="text"
              required
              placeholder="e.g. ADSBUZZ DBBL - 7473"
              value={newPm}
              onChange={(e) => setNewPm(e.target.value)}
              className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
            <button
              type="submit"
              className="bg-brand-orange text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-orange-dark cursor-pointer"
            >
              Add Channel
            </button>
          </form>

        </div>

      </div>

      {/* Delete payment method confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeletePaymentMethod(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Delete payment method?"
        message={`Remove "${deleteTarget ?? ''}" from configured payment channels? This cannot be undone.`}
        confirmLabel="Delete"
        loadingLabel="Deleting..."
      />
    </div>
  );
}

export default memo(SettingsView);
