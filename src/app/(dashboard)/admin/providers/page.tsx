"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Users, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { Id } from "../../../../../convex/_generated/dataModel";

interface ProviderForm {
  name: string;
  credentials: string;
  npi: string;
  clerkUserId: string;
}

const emptyForm: ProviderForm = {
  name: "",
  credentials: "",
  npi: "",
  clerkUserId: "",
};

export default function ProvidersPage() {
  const providers = useQuery(api.providers.list);
  const createProvider = useMutation(api.providers.create);
  const updateProvider = useMutation(api.providers.update);
  const removeProvider = useMutation(api.providers.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"providers"> | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (provider: NonNullable<typeof providers>[number]) => {
    setForm({
      name: provider.name,
      credentials: provider.credentials,
      npi: provider.npi,
      clerkUserId: provider.clerkUserId || "",
    });
    setEditingId(provider._id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateProvider({
          providerId: editingId,
          name: form.name,
          credentials: form.credentials,
          npi: form.npi,
          clerkUserId: form.clerkUserId || undefined,
        });
      } else {
        await createProvider({
          name: form.name,
          credentials: form.credentials,
          npi: form.npi,
          clerkUserId: form.clerkUserId || undefined,
        });
      }
      handleCancel();
    } catch (error) {
      console.error("Failed to save provider:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"providers">) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    await removeProvider({ providerId: id });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Provider Management
          </h1>
          <p className="text-slate-500 mt-1">
            Add, edit, and manage provider profiles
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? "Edit Provider" : "New Provider"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Credentials *
                </label>
                <input
                  type="text"
                  value={form.credentials}
                  onChange={(e) =>
                    setForm({ ...form, credentials: e.target.value })
                  }
                  placeholder="e.g., MD, FACC"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  NPI *
                </label>
                <input
                  type="text"
                  value={form.npi}
                  onChange={(e) =>
                    setForm({ ...form, npi: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clerk User ID
                </label>
                <input
                  type="text"
                  value={form.clerkUserId}
                  onChange={(e) =>
                    setForm({ ...form, clerkUserId: e.target.value })
                  }
                  placeholder="Optional - links to auth account"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {providers === undefined ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No providers yet. Click &quot;Add Provider&quot; to create one.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Credentials
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  NPI
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Signature
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr
                  key={provider._id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {provider.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {provider.credentials}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {provider.npi}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {provider.signatureStorageId ? (
                      <span className="text-green-600 text-xs font-medium">
                        Saved
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(provider)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(provider._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
