'use client';
import { memo, useState } from 'react';
import { Shield, Activity, Plus, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import StatCard from '@/components/common/StatCard';
import PlatformText from '@/components/common/PlatformText';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

// Card-type brand icon helper (visually distinguishes Visa / Mastercard / Union Pay / Amex)
const getCardTypeIcon = (cardType) => {
  const type = (cardType || '').toLowerCase();
  if (type.includes('master')) {
    return {
      label: 'Mastercard',
      render: () => (
        <div className="flex items-center justify-center p-0.5" title="Mastercard">
          <div className="w-4 h-4 rounded-full bg-[#EB001B]" />
          <div className="w-4 h-4 rounded-full bg-[#F79E1B] -ml-2" />
        </div>
      )
    };
  }
  if (type.includes('union')) {
    return {
      label: 'Union Pay',
      render: () => (
        <div
          className="flex items-center justify-center w-14 h-6 rounded-md bg-gradient-to-r from-[#003E7E] via-[#E21836] to-[#0072CE] text-white text-[8px] font-black tracking-tight shadow-xs"
          title="Union Pay"
        >
          UnionPay
        </div>
      )
    };
  }
  if (type.includes('amex') || type.includes('american')) {
    return {
      label: 'American Express',
      render: () => (
        <div
          className="flex items-center justify-center w-12 h-6 rounded-md bg-[#2E77BC] text-white text-[9px] font-black tracking-tight shadow-xs"
          title="American Express"
        >
          AMEX
        </div>
      )
    };
  }
  // Default: Dark navy badge with white VISA logo matching screenshot
  return {
    label: 'Visa',
    render: () => (
      <div
        className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-[#141A56] shadow-xs h-7 min-w-[42px]"
        title="Visa"
      >
        <svg className="h-3 w-auto" viewBox="0 0 36 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.882 0.222L9.08 11.778H6.177L3.738 2.502C3.593 1.935 3.447 1.734 3.013 1.493C2.289 1.1 1.071 0.724 0 0.222H0.076L0.231 0.222H5.068C5.72 0.222 6.27 0.656 6.415 1.397L7.66 8.026L10.741 0.222H13.882ZM25.792 8.375C25.807 5.178 21.36 4.995 21.39 3.567C21.405 3.125 21.834 2.651 22.763 2.53C23.222 2.47 24.508 2.424 25.961 3.097L26.53 0.457C25.748 0.176 24.743 0 23.491 0C20.597 0 18.557 1.542 18.542 3.734C18.511 5.368 19.99 6.284 21.102 6.833C22.244 7.397 22.626 7.748 22.611 8.252C22.596 9.029 21.66 9.38 20.793 9.396C19.339 9.426 18.495 9.014 17.82 8.709L17.237 11.442C18.049 11.808 19.55 12 21.117 12C24.208 12 26.233 10.458 25.792 8.375ZM33.376 11.778H36.126L33.722 0.222H31.21C30.597 0.222 30.082 0.574 29.851 1.123L25.5 11.778H28.608L29.23 10.053H33.023L33.376 11.778ZM30.076 7.69L31.626 3.414L32.516 7.69H30.076ZM18.236 0.222L15.797 11.778H12.834L15.273 0.222H18.236Z" fill="#ffffff"/>
          <path d="M5.068 0.222H0.231L0.076 0.222L0 0.222H0.222C1.293 0.946 2.511 1.322 3.235 1.715C3.669 1.956 3.815 2.157 3.96 2.724L6.4 12H9.303L14.105 0.444H10.964L7.883 8.248L6.638 1.619C6.493 0.878 5.943 0.444 5.291 0.444H5.068V0.222Z" fill="#ffffff"/>
        </svg>
      </div>
    )
  };
};

function CardsView({
  cards,
  adAccounts,
  onAddCard,
  onUpdateCard,
  onToggleCardStatus
}) {
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Create Card State
  const [newCardName, setNewCardName] = useState('');
  const [newCardInitial, setNewCardInitial] = useState('');
  const [newCardType, setNewCardType] = useState('Visa');
  const [newCardPlatform, setNewCardPlatform] = useState('Rizon');
  const [newCardStatus, setNewCardStatus] = useState('Active');

  // Edit Card State
  const [editCardData, setEditCardData] = useState(null);

  const selectedCard = cards.find(c => c.id === selectedCardId) || cards[0];
  
  // Get linked ad accounts list
  const linkedAccounts = adAccounts.filter(acc => acc.billingCard === selectedCard?.cardName);

  const handleCreateCardSubmit = (e) => {
    e.preventDefault();
    if (!newCardName) return;

    onAddCard({
      id: `CARD-${Date.now().toString().slice(-4)}`,
      cardName: newCardName,
      cardType: newCardType,
      cardPlatform: newCardPlatform,
      cardInitial: newCardInitial || newCardName.slice(0, 2).toUpperCase(),
      status: newCardStatus,
      linkedAccountsCount: 0,
      usageCount: 0,
      totalLoadedUSD: 0
    });

    setNewCardName('');
    setNewCardInitial('');
    setNewCardType('Visa');
    setNewCardPlatform('Rizon');
    setNewCardStatus('Active');
    setShowAddModal(false);
  };

  const handleEditCardSubmit = (e) => {
    e.preventDefault();
    if (!editCardData) return;

    if (onUpdateCard) {
      onUpdateCard(editCardData);
    }
    setShowEditModal(false);
    setEditCardData(null);
  };

  const openEditModal = (card) => {
    setEditCardData({ ...card });
    setShowEditModal(true);
  };

  const totalCards = cards.length;
  const totalActiveCards = cards.filter(c => c.status === 'Active' || c.status === 'Available').length;
  const totalDisabledRestrictedCards = cards.filter(c => 
    c.status === 'Disable' || c.status === 'Disabled' || c.status === 'Restricted' || c.status === 'FB Restricted' || c.status === 'Need Support'
  ).length;

  return (
    <div className="space-y-8 animate-fade-in" id="cards-view">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Billing &amp; Funding Cards</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage Mastercard/Visa billing cards linked to publisher ad accounts.</p>
        </div>
        <div>
          <button 
            id="btn-add-card"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer"
          >
            <Plus size={16} /> Log Funding Card
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="TOTAL CARDS"
          value={totalCards}
          variant="blue"
          subtext="All funding & billing cards"
        />
        <StatCard
          title="TOTAL ACTIVE CARDS"
          value={totalActiveCards}
          variant="emerald"
          subtext="Active & operational cards"
        />
        <StatCard
          title="TOTAL DISABLED & RESTRICTED CARDS"
          value={totalDisabledRestrictedCards}
          variant="rose"
          subtext="Disabled, restricted, or support needed"
        />
      </div>

      {/* Grid of Credit Card Objects & detailed panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Interactive Credit Card List (span 5) */}
        <div className="lg:col-span-5 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Wallet Cards</p>
          <div className="space-y-4" id="cards-list-box">
            {cards.map((card) => {
              const isSelected = selectedCardId === card.id;
              return (
                <div
                  key={card.id}
                  id={`card-item-${card.id}`}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`p-6 rounded-2xl relative overflow-hidden transition-all cursor-pointer transform hover:-translate-y-0.5 ${
                    isSelected 
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-brand-orange shadow-md ring-2 ring-brand-orange/10' 
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Funding Card Display</p>
                      <h3 className="text-sm font-bold tracking-tight">{card.cardName}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Type: <strong className="text-slate-700 dark:text-slate-300">{card.cardType || 'Visa'}</strong></span>
                        <span className="hidden sm:inline">•</span>
                        <span>Platform: <strong className="text-slate-700 dark:text-slate-300">{card.cardPlatform || 'N/A'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(card);
                          }}
                          leftIcon={<Edit2 size={11} />}
                          title="Edit Card"
                        >
                          Edit
                        </Button>
                      {(() => {
                        const Icon = getCardTypeIcon(card.cardType);
                        return <Icon.render />;
                      })()}
                    </div>
                  </div>

                  {/* Card bottom info */}
                  <div className="mt-8 flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-50">Total Loaded USD</p>
                      <p className="text-lg font-bold">${card.totalLoadedUSD.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${
                        card.status === 'Active' || card.status === 'Available'
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : card.status === 'Need Support'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {card.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Card Details (span 7) */}
        {selectedCard ? (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm shadow-slate-100 dark:shadow-none space-y-6" id="card-details-pane">
            
            {/* Details Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{selectedCard.cardName}</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedCard.status === 'Active' || selectedCard.status === 'Available'
                      ? 'bg-emerald-500/20 text-emerald-500' 
                      : selectedCard.status === 'Need Support'
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'bg-red-500/20 text-red-500'
                  }`}>
                    {selectedCard.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span>Card Type: <strong className="text-slate-700 dark:text-slate-300">{selectedCard.cardType || 'Visa'}</strong></span>
                  <span>•</span>
                  <span>Platform: <strong className="text-slate-700 dark:text-slate-300">{selectedCard.cardPlatform || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Linked: {linkedAccounts.length} active ad accounts</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  id="btn-edit-card"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(selectedCard)}
                  leftIcon={<Edit2 size={11} />}
                >
                  Edit Card
                </Button>
                <button 
                  id="btn-toggle-card"
                  onClick={() => onToggleCardStatus(selectedCard.id)}
                  className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  {selectedCard.status === 'Active' ? (
                    <>
                      <ToggleRight className="text-emerald-500" size={24} /> Disable Card
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="text-slate-400" size={24} /> Enable Card
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total USD Funding</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">${selectedCard.totalLoadedUSD.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400">Txn Frequency</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">{selectedCard.usageCount} times</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-400">Security Shield</p>
                <p className="text-base font-bold text-emerald-500 mt-1 flex items-center gap-1">
                  <Shield size={14} /> Active
                </p>
              </div>
            </div>

            {/* List of associated social ad accounts */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Associated Ad Accounts</h3>
              {linkedAccounts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No ad accounts are currently linked to this funding card.</p>
              ) : (
                <div className="space-y-2.5">
                  {linkedAccounts.map((acc) => (
                    <div 
                      key={acc.adAccountId}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{acc.adAccountName}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {acc.adAccountId}</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-xs overflow-hidden">
                        <PlatformText platform={acc.platform} variant="badge" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loaded Ledger History */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loaded Funding History</h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <Activity size={14} className="text-slate-400" />
                <span>Automatically syncs loaded USD amounts from top-ups of linked ad accounts.</span>
              </div>
            </div>

          </div>
        ) : null}

      </div>

      {/* Add Card Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register Funding Credit Card"
        size="sm"
        variant="animated"
      >
        <form onSubmit={handleCreateCardSubmit} className="p-6 space-y-4" id="form-add-card">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Display Name</label>
            <input
              id="add-card-name"
              type="text"
              required
              placeholder="e.g. ADSBUZZ DBBL - 7473"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Initials</label>
            <input
              id="add-card-initial"
              type="text"
              placeholder="e.g. DB"
              maxLength={2}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
              value={newCardInitial}
              onChange={(e) => setNewCardInitial(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Type</label>
            <select
              id="add-card-type"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newCardType}
              onChange={(e) => setNewCardType(e.target.value)}
            >
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Union Pay">Union Pay</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Platform</label>
            <select
              id="add-card-platform"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newCardPlatform}
              onChange={(e) => setNewCardPlatform(e.target.value)}
            >
              <option value="">Select platform</option>
              <option value="RIZON">RIZON</option>
              <option value="BYBIT">BYBIT</option>
              <option value="PAYONNER">PAYONNER</option>
              <option value="WISE">WISE</option>
              <option value="AIRWALEX">AIRWALEX</option>
              <option value="MERCURY">MERCURY</option>
              <option value="MEDIA BUYING">MEDIA BUYING</option>
              <option value="REDOTPAY">REDOTPAY</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="add-card-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={newCardStatus}
              onChange={(e) => setNewCardStatus(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Disable">Disable</option>
              <option value="Restricted">Restricted</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit">Register Card</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Card Modal */}
      <Modal
        isOpen={showEditModal && !!editCardData}
        onClose={() => setShowEditModal(false)}
        title="Edit Billing Card"
        size="sm"
        variant="animated"
      >
        <form onSubmit={handleEditCardSubmit} className="p-6 space-y-4" id="form-edit-card">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Display Name</label>
            <input
              id="edit-card-name"
              type="text"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCardData?.cardName ?? ''}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, cardName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Initials</label>
            <input
              id="edit-card-initial"
              type="text"
              maxLength={2}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
              value={editCardData?.cardInitial ?? ''}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, cardInitial: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Type</label>
            <input
              id="edit-card-type"
              type="text"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCardData?.cardType || ''}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, cardType: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Card Platform</label>
            <input
              id="edit-card-platform"
              type="text"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCardData?.cardPlatform || ''}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, cardPlatform: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Total Loaded USD ($)</label>
            <input
              id="edit-card-loaded"
              type="number"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCardData?.totalLoadedUSD ?? 0}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, totalLoadedUSD: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="edit-card-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={editCardData?.status ?? 'Active'}
              onChange={(e) => editCardData && setEditCardData({ ...editCardData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Disable">Disable</option>
              <option value="FB Restricted">FB Restricted</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default memo(CardsView);
