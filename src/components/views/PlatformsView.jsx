'use client';
import { memo, useState } from 'react';
import { Plus, Globe, ToggleLeft, ToggleRight, Edit2, Trash2 } from 'lucide-react';
import StatCard from '@/components/common/StatCard';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SearchBar from '@/components/ui/SearchBar';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FieldError from '@/components/ui/FieldError';
import { validate, hasErrors, required, maxLength } from '@/utils/formValidation';

function PlatformsView({
  platforms,
  onAddPlatform,
  onUpdatePlatform,
  onTogglePlatformStatus,
  onDeletePlatform,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteData, setShowDeleteData] = useState(null);

  const [newName, setNewName] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [newStatus, setNewStatus] = useState('Active');

  const [editData, setEditData] = useState(null);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  const filtered = platforms.filter(p =>
    p.platformName.toLowerCase().includes(search.toLowerCase()) ||
    p.platformId.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = platforms.filter(p => p.status === 'Active').length;
  const disabledCount = platforms.filter(p => p.status === 'Disabled').length;

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const errors = validate(
      { name: newName },
      { name: [required('Platform name is required'), maxLength(60)] },
    );
    if (hasErrors(errors)) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});

    onAddPlatform({
      platformId: `PLAT-${Date.now().toString().slice(-3)}`,
      platformName: newName,
      platformLogo: newLogo,
      status: newStatus,
    });

    setNewName('');
    setNewLogo('');
    setNewStatus('Active');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editData) return;

    const errors = validate(
      { name: editData.platformName },
      { name: [required('Platform name is required'), maxLength(60)] },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});

    if (onUpdatePlatform) onUpdatePlatform(editData);
    setShowEditModal(false);
    setEditData(null);
  };

  const openEditModal = (platform) => {
    setEditData({ ...platform });
    setShowEditModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteData || !onDeletePlatform) return;
    try {
      await onDeletePlatform(showDeleteData.platformId);
    } catch {
      // Error toast raised by the hook/context.
    } finally {
      setShowDeleteData(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="platforms-view">
      <ErrorBanner error={error} onRetry={onRetry} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Platform Registry</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Catalog of funding / payment platforms used for billing cards &amp; wallets.</p>
        </div>
        <div>
          <button
            id="btn-add-platform"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer"
          >
            <Plus size={16} /> Add Platform
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="TOTAL PLATFORMS" value={platforms.length} variant="blue" subtext="All registered platforms" />
        <StatCard title="ACTIVE" value={activeCount} variant="emerald" subtext="Active &amp; operational" />
        <StatCard title="DISABLED" value={disabledCount} variant="rose" subtext="Disabled platforms" />
      </div>

      {/* Search */}
      <SearchBar
        maxWidthClass="w-full"
        placeholder="Search platforms by name or code..."
        value={search}
        onChange={(value) => setSearch(value)}
      />

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" id="platforms-grid">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center col-span-full bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            No platforms found.
          </p>
        ) : (
          filtered.map((platform) => (
            <div
              key={platform.platformId}
              id={`platform-item-${platform.platformId}`}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-surface-blue dark:bg-surface-blue border border-border-blue dark:border-border-blue flex items-center justify-center text-brand-blue-deep dark:text-brand-blue-deep font-black text-sm shadow-xs">
                    {platform.platformLogo || <Globe size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{platform.platformName}</h3>
                    <p className="text-[10px] font-mono text-slate-400">{platform.platformId}</p>
                  </div>
                </div>
                <Badge variant={platform.status === 'Active' ? 'success' : 'danger'}>{platform.status}</Badge>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onTogglePlatformStatus(platform.platformId)}
                  className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Toggle status"
                >
                  {platform.status === 'Active' ? (
                    <><ToggleRight className="text-emerald-500" size={20} /> Disable</>
                  ) : (
                    <><ToggleLeft className="text-slate-400" size={20} /> Enable</>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(platform)}
                    leftIcon={<Edit2 size={11} />}
                    title="Edit Platform"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteData(platform)}
                    leftIcon={<Trash2 size={11} />}
                    className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Platform Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddFormErrors({}); }}
        title="Add Platform"
        size="sm"
        variant="animated"
      >
        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4" id="form-add-platform">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform Name</label>
            <input
              id="add-platform-name"
              type="text"
              required
              placeholder="e.g. Rizon"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <FieldError error={addFormErrors.name} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform Logo</label>
            <input
              id="add-platform-logo"
              type="text"
              placeholder="e.g. RZ or a logo URL"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newLogo}
              onChange={(e) => setNewLogo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="add-platform-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit">Save Platform</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Platform Modal */}
      <Modal
        isOpen={showEditModal && !!editData}
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); }}
        title="Edit Platform"
        size="sm"
        variant="animated"
      >
        <form onSubmit={handleEditSubmit} className="p-6 space-y-4" id="form-edit-platform">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform Code</label>
            <input
              type="text"
              disabled
              value={editData?.platformId ?? ''}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-mono cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform Name</label>
            <input
              id="edit-platform-name"
              type="text"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editData?.platformName ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, platformName: e.target.value })}
            />
            <FieldError error={editFormErrors.name} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform Logo</label>
            <input
              id="edit-platform-logo"
              type="text"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editData?.platformLogo ?? ''}
              onChange={(e) => editData && setEditData({ ...editData, platformLogo: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="edit-platform-status"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
              value={editData?.status ?? 'Active'}
              onChange={(e) => editData && setEditData({ ...editData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Platform Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeleteData}
        onClose={() => setShowDeleteData(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Platform?"
        message={`This will permanently remove ${showDeleteData?.platformName} (${showDeleteData?.platformId}) from the platform registry. This action cannot be undone.`}
        confirmLabel="Delete Platform"
        variant="danger"
      />
    </div>
  );
}

export default memo(PlatformsView);
