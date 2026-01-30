"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { BookOpen, Save, Check, RotateCcw } from "lucide-react";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function RulesPage() {
  const { user } = useUser();
  const rules = useQuery(api.rules.list);
  const updateRule = useMutation(api.rules.update);
  const seedRules = useMutation(api.rules.seed);

  const [editingId, setEditingId] = useState<Id<"authorizationRules"> | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleEdit = (rule: NonNullable<typeof rules>[number]) => {
    setEditingId(rule._id);
    setEditContent(rule.ruleContent);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSave = async (ruleId: Id<"authorizationRules">) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateRule({
        ruleId,
        ruleContent: editContent,
        updatedBy: user.id,
      });
      setSavedId(ruleId);
      setEditingId(null);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error("Failed to save rule:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    await seedRules();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-600" />
            Authorization Rules
          </h1>
          <p className="text-slate-500 mt-1">
            Edit the authorization criteria used by the AI processing engine
          </p>
        </div>
        {rules && rules.length === 0 && (
          <button
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Load Default Rules
          </button>
        )}
      </div>

      {rules === undefined ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-500 mb-4">
            No authorization rules found. Load the default rule sets to get
            started.
          </p>
          <button
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Load Default Rules
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">
                  {rule.ruleName}
                </h3>
                <div className="flex items-center gap-2">
                  {rule.updatedAt && (
                    <span className="text-xs text-slate-400">
                      Updated:{" "}
                      {new Date(rule.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                  {savedId === rule._id && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                {editingId === rule._id ? (
                  <>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={15}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-y"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSave(rule._id)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                      {rule.ruleContent}
                    </pre>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors"
                    >
                      Edit Rules
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
