'use client';
import { memo, useState } from 'react';
import { Plus, Wallet, ShieldCheck, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import StatCard from '@/components/common/StatCard';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SearchBar from '@/components/ui/SearchBar';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FieldError from '@/components/ui/FieldError';
import { validate, hasErrors, required, maxLength } from '@/utils/formValidation';

function WalletsView({
  wallets,
  platforms = [],
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteData, setShowDeleteData] = useState(null);

  const [newOwner, setNewOwner] = useState('');
  const [newIdCard, setNewIdCard] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newSecurity, setNewSecurity] = useState('High');
  const [newWalletStatus, setNewWalletStatus] = useState('Active');

  const [editData, setEditData] = useState(null);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  const filtered = wallets.filter(w =>
    w.ownerName.toLowerCase().includes(search.toLowerCase()) ||
    w.walletId.toLowerCase().includes(search.toLowerCase()) ||
    w.email.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = wallets.filter(w => w.walletStatus === 'Active').length;
  const restrictedCount = wallets.filter(w => w.walletStatus === 'Restricted').length;
  const highSecurityCount = wallets.filter(w => w.accountSecurityStatus === 'High').length;

  const securityBadge = (status) => {
    if (status === 'High') return <Badge tone="success"><ShieldCheck size={10} /> High</Badge>;
    if (status === 'Low') return <Badge tone="danger"><ShieldAlert size={10} /> Low</Badge>;
    return <Badge tone="warning"><ShieldAlert size={10} /> Medium</Badge>;
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const errors = validate(
      {
        owner: newOwner,
        idCard: newIdCard,
        source: newSource,
        email: newEmail,
        platform: newPlatform,
      },
      {
        owner: [required('Owner name is required'), maxLength(100)],
        idCard: [required('ID card info is required'), maxLength(100)],
        source: [required('Source by is required'), maxLength(100)],
        email: [required('Email is required'), maxLength(254)],
        platform: [required('Platform is required')],
      },
    );
    if (hasErrors(errors)) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});

    onAddWallet({
      walletId: `WALLET-${Date.now().toString().slice(-3)}`,
      ownerName: newOwner,
      idCardInfo: newIdCard,
      sourceBy: newSource,
      email: newEmail,
      platformId: newPlatform,
      accountSecurityStatus: newSecurity,
      walletStatus: newWalletStatus,
    });

    setNewOwner('');
    setNewIdCard('');
    setNewSource('');
    setNewEmail('');
    setNewPlatform('');
    setNewSecurity('High');
    setNewWalletStatus('Active');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editData) return;

    const errors = validate(
      { owner: editData.ownerName, email: editData.email },
      {
        owner: [required('Owner name is required'), maxLength(100)],
        email: [required('Email is required'), maxLength(254)],
      },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});

    if (onUpdateWallet) onUpdateWallet(editData);
    setShowEditModal(false);
    setEditData(null);
  };

  const openEditModal = (wallet) => {
    setEditData({ ...wallet });
    setShowEditModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteData || !onDeleteWallet) return;
    try {
      await onDeleteWallet(showDeleteData.walletId);
    } catch {
      // Error toast raised by the hook/context.
    } finally {
      setShowDeleteData(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="wallets-view">
      <ErrorBanner error={error} onRetry={onRetry} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Wallet Registry</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage funding wallets, their owners and security posture.</p>
        </div>
        <div>
          <button
            id="btn-add-wallet"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer"
          >
            <Plus size={16} /> Add Wallets
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="TOTAL WALLETS" value={wallets.length} variant="blue" subtext="All registered wallets" />
        <StatCard title="ACTIVE" value={activeCount} variant="emerald" subtext="Active &amp; operational" />
        <StatCard title="RESTRICTED" value={restrictedCount} variant="rose" subtext="Restricted wallets" />
        <StatCard title="HIGH SECURITY" value={highSecurityCount} variant="amber" subtext="Wallets with high security" />
      </div>

      {/* Search */}
      <SearchBar
        maxWidthClass="w-full"
        placeholder="Search wallets by owner, code or email..."
        value={search}
        onChange={(value) => setSearch(value)}
      />

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="wallets-grid">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center col-span-full bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            No wallets found.
          </p>
        ) : (
          filtered.map((wallet) => {
            const platform = platforms.find(p => p.platformId === wallet.platformId);
            return (
              <div
                key={wallet.walletId}
                id={`wallet-item-${wallet.walletId}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-surface-green dark:bg-surface-green border border-border-green dark:border-border-green flex items-center justify-center text-brand-blue-deep dark:text-brand-blue-deep">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{wallet.ownerName}</h3>
                      <p className="text-[10px] font-mono text-slate-400">{wallet.walletId}</p>
                    </div>
                  </div>
                  <Badge tone={wallet.walletStatus === 'Active' ? 'success' : 'danger'}>{wallet.walletStatus}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ID Card Info</p>
                    <p className="text-slate-700 dark:text-slate-300 font-mono mt-0.5">{wallet.idCardInfo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Source By</p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{wallet.sourceBy}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email</p>
                    <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5">{wallet.email}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Account Security Status</p>
                    {securityBadge(wallet.accountSecurityStatus)}
                  </div>
                  {platform && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Platform</p>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{platform.platformName}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">Last updated: {wallet.updatedAt ? new Date(wallet.updatedAt).toLocaleDateString() : '—'}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(wallet)}
                      leftIcon={<Edit2 size={11} />}
                      title="Edit Wallet"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteData(wallet)}
                      leftIcon={<Trash2 size={11} />}
                      className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Wallet Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddFormErrors({}); }}
        title="Add Wallets"
        size="md"
        variant="animated"
      >
        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4" id="form-add-wallet">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Platform</label>
            <select
              id="add-wallet-platform"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
            >
              <option value="">Select platform</option>
              {platforms.map((p) => (
                <option key={p.platformId} value={p.platformId}>{p.platformName}</option>
              ))}
            </select>
            <FieldError error={addFormErrors.platform} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Owner Name</label>
            <input
              id="add-wallet-owner"
              type="text"
              required
              placeholder="e.g. AdsBuzz Corp"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
            />
            <FieldError error={addFormErrors.owner} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">ID Card Info</label>
            <input
              id="add-wallet-idcard"
              type="text"
              required
              placeholder="e.g. NID-7788991"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
              value={newIdCard}
              onChange={(e) => setNewIdCard(e.target.value)}
            />
            <FieldError error={addFormErrors.idCard} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Source By</label>
            <input
              id="add-wallet-source"
              type="text"
              required
              placeholder="e.g. Bank Transfer, bKash, Nagad"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
            />
            <FieldError error={addFormErrors.source} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
            <input
              id="add-wallet-email"
              type="email"
              required
              placeholder="e.g. finance@adsbuzz.com"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <FieldError error={addFormErrors.email} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Security Status</label>
            <select
              id="add-wallet-security"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={newSecurity}
              onChange={(e) => setNewSecurity(e.target.value)}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Wallet Status</label>
            <select
              id="add-wallet-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={newWalletStatus}
              onChange={(e) => setNewWalletStatus(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Restricted">Restricted</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit">Save Wallet</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Wallet Modal */}
      <Modal
        isOpen={showEditModal && !!editData}
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); }}
        title="Edit Wallet"
        size="md"
        variant="animated"
      >
        <form onSubmit={handleEditSubmit} className="p-6 space-y-4" id="form-edit-wallet">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Wallet Code</label>
            <input
              type="text"
              disabled
              value={editData?.walletId ?? ''}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-mono cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Platform</label>
            <select
              id="edit-wallet-platform"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={editData?.platformId ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, platformId: e.target.value })}
            >
              <option value="">Select platform</option>
              {platforms.map((p) => (
                <option key={p.platformId} value={p.platformId}>{p.platformName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Owner Name</label>
            <input
              id="edit-wallet-owner"
              type="text"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editData?.ownerName ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, ownerName: e.target.value })}
            />
            <FieldError error={editFormErrors.owner} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">ID Card Info</label>
            <input
              id="edit-wallet-idcard"
              type="text"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
              value={editData?.idCardInfo ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, idCardInfo: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Source By</label>
            <input
              id="edit-wallet-source"
              type="text"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editData?.sourceBy ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, sourceBy: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
            <input
              id="edit-wallet-email"
              type="email"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editData?.email ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, email: e.target.value })}
            />
            <FieldError error={editFormErrors.email} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Security Status</label>
            <select
              id="edit-wallet-security"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={editData?.accountSecurityStatus ?? 'High'}
              onChange={(e) => editData && setEditData({ ...editData, accountSecurityStatus: e.target.value })}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Wallet Status</label>
            <select
              id="edit-wallet-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={editData?.walletStatus ?? 'Active'}
              onChange={(e) => editData && setEditData({ ...editData, walletStatus: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Restricted">Restricted</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Wallet Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeleteData}
        onClose={() => setShowDeleteData(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Wallet?"
        message={`This will permanently remove ${showDeleteData?.ownerName} (${showDeleteData?.walletId}) from the wallet registry. This action cannot be undone.`}
        confirmLabel="Delete Wallet"
        variant="danger"
      />
    </div>
  );
}

export default memo(WalletsView);
