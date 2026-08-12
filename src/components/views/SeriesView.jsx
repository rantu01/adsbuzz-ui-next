'use client';
import { memo, useState } from 'react';
import { Plus, FileEdit, Trash2 } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import StatCard from '@/components/common/StatCard';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchBar from '@/components/ui/SearchBar';

function SeriesView({ series, adAccounts, onAddSeries, onUpdateSeries, onDeleteSeries, error, onRetry }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [plat, setPlat] = useState('Facebook');
  const [newStatus, setNewStatus] = useState('Active');

  const [editSeriesData, setEditSeriesData] = useState(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState(series[0]?.seriesId || '');

  const filtered = series.filter(s => s.seriesName.toLowerCase().includes(search.toLowerCase()) || s.seriesId.toLowerCase().includes(search.toLowerCase()));

  const activeSeries = series.find(s => s.seriesId === selectedSeriesId) || series[0];
  const linkedAccounts = adAccounts ? adAccounts.filter(acc => acc.seriesId === activeSeries?.seriesId && (statusFilter === 'All' || acc.accountStatus === statusFilter)) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newName) return;
    const sId = newId || `SERIES-${Date.now().toString().slice(-3)}`;
    onAddSeries({
      seriesId: sId,
      seriesName: newName,
      platform: plat,
      status: newStatus
    });
    setSelectedSeriesId(sId);
    setNewName('');
    setNewId('');
    setPlat('Facebook');
    setNewStatus('Active');
    setShowModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editSeriesData) return;
    if (onUpdateSeries) {
      onUpdateSeries(editSeriesData);
    }
    setShowEditModal(false);
    setEditSeriesData(null);
  };

  const openEditModal = (s) => {
    setEditSeriesData({ ...s });
    setShowEditModal(true);
  };

  const openDeleteModal = (s) => {
    setDeleteBlocked(false);
    if (linkedAccounts.length > 0) {
      setDeleteBlocked(true);
      setShowDeleteModal(false);
      return;
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!activeSeries || !onDeleteSeries) return;
    const deletedId = activeSeries.seriesId;
    try {
      await onDeleteSeries(deletedId);
    } catch {
      // Error toast raised by the hook/context.
    } finally {
      setShowDeleteModal(false);
      setDeleteBlocked(false);
      const remaining = series.filter(s => s.seriesId !== deletedId);
      if (remaining.length > 0) {
        setSelectedSeriesId(remaining[0].seriesId);
      } else {
        setSelectedSeriesId('');
      }
    }
  };

  const totalSeries = series.length;
  const totalAdAccounts = adAccounts ? adAccounts.length : 0;
  const totalPlatforms = new Set(series.map(s => s.platform)).size;

  return (
    <div className="space-y-6 animate-fade-in">
      <ErrorBanner error={error} onRetry={onRetry} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Account Series Registry</h1>
          <p className="text-sm text-slate-500">Catalog of system sub-allocators (e.g. 90's Series, VH Series, Bijoy Series).</p>
        </div>
        <Button
          id="btn-add-series"
          onClick={() => setShowModal(true)}
          leftIcon={<Plus size={14} />}
        >
          Log Series
        </Button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="TOTAL SERIES"
          value={totalSeries}
          variant="blue"
          subtext="All cataloged account series"
        />
        <StatCard
          title="TOTAL AD ACCOUNT"
          value={totalAdAccounts}
          variant="emerald"
          subtext="All registered social ad accounts"
        />
        <StatCard
          title="TOTAL PLATFORM"
          value={totalPlatforms}
          variant="amber"
          subtext="Supported advertising networks"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div id="series-registry-card" className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <SearchBar
              showIcon={false}
              placeholder="Search series by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4">Series Code</th>
                  <th scope="col" className="py-3.5">Series Name</th>
                  <th scope="col" className="py-3.5">Platform</th>
                  <th scope="col" className="py-3.5 text-center">Status</th>
                  <th scope="col" className="py-3.5 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedSeriesId(s.seriesId)}
                    style={{ borderLeft: activeSeries?.seriesId === s.seriesId ? '5px solid #154A7D' : '5px solid transparent' }}
                    className={`cursor-pointer transition-colors ${
                      activeSeries?.seriesId === s.seriesId
                        ? 'font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3.5 pl-4 font-bold font-mono">{s.seriesId}</td>
                    <td className="py-3.5 font-semibold">{s.seriesName}</td>
                    <td className="py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs"><PlatformText platform={s.platform} variant="badge" /></span></td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm inline-block ${
                        s.status === 'Active' || s.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        s.status === 'Need Support' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(s);
                        }}
                        leftIcon={<FileEdit size={11} />}
                        className="ml-auto"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Series Detailed Card */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-6">
          {activeSeries ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-brand-orange bg-brand-orange/10 px-2.5 py-1 rounded-md">
                    Series Profile
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteModal(activeSeries)}
                      leftIcon={<Trash2 size={11} />}
                      className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                    >
                      Delete Series
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(activeSeries)}
                      leftIcon={<FileEdit size={11} />}
                    >
                      Edit
                    </Button>
                </div>
              </div>
              {deleteBlocked && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 mt-2">
                  <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    Please Unassign Ad Accounts From This Series and Try Again Later.
                  </span>
                </div>
              )}
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-3 flex items-center justify-between">
                  <span>{activeSeries.seriesName}</span>
                  <span className="text-xs font-mono font-black text-white bg-gradient-to-r from-brand-blue to-[#2980b9] dark:from-brand-orange dark:to-brand-orange-dark px-2.5 py-1 rounded-md shadow-xs ring-1 ring-brand-blue/30 dark:ring-brand-orange/30">
                    {activeSeries.seriesId}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1.5">Platform: <PlatformText platform={activeSeries.platform} className="font-semibold text-xs" /></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-blue dark:bg-surface-blue p-3.5 rounded-xl border border-border-blue dark:border-border-blue shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider block mb-1">Total Ad Accounts</span>
                  <span className="text-2xl font-black text-brand-blue-deep dark:text-brand-blue-deep">{linkedAccounts.length}</span>
                </div>
                <div className="bg-surface-green dark:bg-surface-green p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider block mb-1">No of Available</span>
                  <span className="text-2xl font-black text-brand-blue-deep dark:text-brand-blue-deep">
                    {linkedAccounts.filter(a => a.accountStatus === 'Available').length}
                  </span>
                </div>
                <div className="bg-surface-rose dark:bg-surface-rose p-3.5 rounded-xl border border-border-rose dark:border-border-rose shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider block mb-1">No of Disable</span>
                  <span className="text-2xl font-black text-brand-blue-deep dark:text-brand-blue-deep">
                    {linkedAccounts.filter(a => a.accountStatus === 'Disabled' || a.accountStatus === 'Disable').length}
                  </span>
                </div>
                <div className="bg-surface-orange dark:bg-surface-orange p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider block mb-1">No of Sold</span>
                  <span className="text-2xl font-black text-brand-blue-deep dark:text-brand-blue-deep">
                    {linkedAccounts.filter(a => a.accountStatus === 'Sold').length}
                  </span>
                </div>
                <div className="bg-surface-blue-light dark:bg-surface-blue-light p-3.5 rounded-xl border border-border-blue-light dark:border-border-blue-light shadow-xs col-span-2">
                  <span className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider block mb-1">No of Terminated</span>
                  <span className="text-2xl font-black text-brand-blue-deep dark:text-brand-blue-deep">
                    {linkedAccounts.filter(a => a.accountStatus === 'Terminated').length}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Associated Ad Accounts
                </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                    <option value="Sold">Sold</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                  <span>{linkedAccounts.length}</span>
                </div>
                {linkedAccounts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    No active ad accounts associated with this series on file.
                  </p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {linkedAccounts.map((acc, index) => (
                      <div
                        key={index}
                        className="p-3 bg-surface dark:bg-surface rounded-xl border border-border-blue-light dark:border-border-blue-light flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 mr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{acc.adAccountName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{acc.adAccountId}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                          acc.accountStatus === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          acc.accountStatus === 'Disabled' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {acc.accountStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <p className="text-sm">Select a series to view associated ad accounts</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Series Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Series Code"
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handleSubmit} className="space-y-4" id="form-add-series">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Series ID Code</label>
            <input type="text" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="e.g. S-90S" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Series Label Name</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="e.g. VH Series" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
            <select value={plat} onChange={(e) => setPlat(e.target.value)} className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium">
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Google">Google</option>
              <option value="Snapchat">Snapchat</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium">
              <option value="Active">Active</option>
              <option value="Disable">Disable</option>
            </select>
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">Save Series</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Series Modal */}
      <Modal
        isOpen={showEditModal && !!editSeriesData}
        onClose={() => setShowEditModal(false)}
        title="Edit Series"
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" id="form-edit-series">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Series ID Code</label>
            <input
              type="text"
              disabled
              value={editSeriesData?.seriesId ?? ''}
              className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 font-mono cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Series Label Name</label>
            <input
              type="text"
              required
              value={editSeriesData?.seriesName ?? ''}
              onChange={(e) => editSeriesData && setEditSeriesData({ ...editSeriesData, seriesName: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
            <select
              value={editSeriesData?.platform ?? 'Facebook'}
              onChange={(e) => editSeriesData && setEditSeriesData({ ...editSeriesData, platform: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Google">Google</option>
              <option value="Snapchat">Snapchat</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            <select
              value={editSeriesData?.status ?? 'Active'}
              onChange={(e) => editSeriesData && setEditSeriesData({ ...editSeriesData, status: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Active">Active</option>
              <option value="Sold">Sold</option>
              <option value="Disable">Disable</option>
              <option value="Need Support">Need Support</option>
              <option value="Available">Available</option>
            </select>
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Series Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Series?"
        message={`This will permanently remove ${activeSeries?.seriesName} (${activeSeries?.seriesId}) from the series registry. This action cannot be undone.`}
        confirmLabel="Delete Series"
        variant="danger"
      />
    </div>
  );
}

export default memo(SeriesView);