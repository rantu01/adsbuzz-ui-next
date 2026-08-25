'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Layers,
  Tags,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatCard from '@/components/common/StatCard';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Badge from '@/components/ui/Badge';

function OfficeExpensesView({
  officeExpenses = [],
  error,
  onRetry,
  onAddOfficeExpense,
  onUpdateOfficeExpense,
  onDeleteOfficeExpense,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeMain = searchParams.get('main');

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formMain, setFormMain] = useState('');
  const [formSubs, setFormSubs] = useState('');
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const totalSubCategories = useMemo(
    () => officeExpenses.reduce((sum, c) => sum + (c.subCategories?.length || 0), 0),
    [officeExpenses],
  );

  const visibleExpenses = useMemo(() => {
    let list = officeExpenses;
    if (activeMain) {
      list = list.filter((c) => c.mainCategory === activeMain);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.mainCategory?.toLowerCase().includes(q) ||
          (c.subCategories || []).some((s) => s.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [officeExpenses, activeMain, search]);

  const openAdd = () => {
    setEditing(null);
    setFormMain('');
    setFormSubs('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setFormMain(category.mainCategory || '');
    setFormSubs((category.subCategories || []).join('\n'));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const mainCategory = formMain.trim();
    if (!mainCategory) {
      setFormError('Main category is required.');
      return;
    }
    const payload = { mainCategory, subCategories: formSubs };
    try {
      if (editing) {
        await onUpdateOfficeExpense({ ...editing, mainCategory, subCategories: formSubs });
      } else {
        await onAddOfficeExpense(payload);
      }
      setIsModalOpen(false);
      setEditing(null);
    } catch {
      // toast already shown by context
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await onDeleteOfficeExpense(pendingDelete.id);
    } catch {
      // toast already shown by context
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt size={22} className="text-brand-orange" />
            Office Expense Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage office expense categories and their sub-categories. Imported from the AdsBuzz LLC accounts setting.
          </p>
        </div>
        <Button id="btn-add-office-expense" onClick={openAdd} leftIcon={<Plus size={14} />}>
          Add Category
        </Button>
      </div>

      <ErrorBanner error={error} onRetry={onRetry} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="TOTAL CATEGORIES"
          value={officeExpenses.length}
          variant="blue"
          subtext="Main expense groups"
          icon={<Layers size={20} />}
        />
        <StatCard
          title="SUB-CATEGORIES"
          value={totalSubCategories}
          variant="amber"
          subtext="Classification items"
          icon={<Tags size={20} />}
        />
        <StatCard
          title="SETTING SOURCE"
          value="LLC Accounts"
          variant="emerald"
          subtext="AdsBuzz LLC accounts setting"
          icon={<Receipt size={20} />}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search categories or sub-categories…"
        />
        {activeMain && (
          <button
            type="button"
            onClick={() => router.replace('/office-expense/settings')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
          >
            <X size={14} /> Clear filter: {activeMain}
          </button>
        )}
      </div>

      {visibleExpenses.length === 0 ? (
        <div
          id="office-expenses-empty"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-10 text-center"
        >
          <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No office expense categories found.</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={openAdd} leftIcon={<Plus size={12} />}>
            Add your first category
          </Button>
        </div>
      ) : (
        <div
          id="office-expenses-card"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {visibleExpenses.map((category) => (
            <div
              key={category.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {category.mainCategory}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(category.subCategories?.length || 0)} sub-categories
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id={`edit-${category.id}`}
                    onClick={() => openEdit(category)}
                    aria-label={`Edit ${category.mainCategory}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    id={`delete-${category.id}`}
                    onClick={() => setPendingDelete(category)}
                    aria-label={`Delete ${category.mainCategory}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(category.subCategories || []).map((sub, idx) => (
                  <Badge key={`${sub}-${idx}`} tone="info" style="box">
                    {sub}
                  </Badge>
                ))}
                {(category.subCategories || []).length === 0 && (
                  <span className="text-[11px] text-slate-400 italic">No sub-categories yet.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit Office Expense Category' : 'Add Office Expense Category'}
        description="Define a main category and its sub-categories (one per line)."
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Main Category</label>
            <input
              id="office-expense-main"
              type="text"
              value={formMain}
              onChange={(e) => setFormMain(e.target.value)}
              placeholder="e.g. Utility"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Sub-Categories
            </label>
            <textarea
              id="office-expense-subs"
              value={formSubs}
              onChange={(e) => setFormSubs(e.target.value)}
              rows={6}
              placeholder={"Home Rent\nInternet\nElectricity"}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700 resize-y"
            />
            <p className="text-[10px] text-slate-400">Separate sub-categories with a new line or comma.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button id="office-expense-save" onClick={handleSubmit}>
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete Office Expense Category"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.mainCategory}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default OfficeExpensesView;
