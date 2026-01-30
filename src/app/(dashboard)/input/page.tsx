"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { ClipboardList, Send, RotateCcw } from "lucide-react";

export default function InputPage() {
  const { user } = useUser();
  const createPatient = useMutation(api.patients.create);
  const processPatient = useAction(api.processing.processPatient);
  const seedRules = useMutation(api.rules.seed);

  const mrnRef = useRef<HTMLInputElement>(null);
  const [mrn, setMrn] = useState("");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [patientType, setPatientType] = useState<"NEW" | "FOLLOWUP">("NEW");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [insuranceInfo, setInsuranceInfo] = useState("");
  const [previousStudies, setPreviousStudies] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  useEffect(() => {
    seedRules();
  }, [seedRules]);

  useEffect(() => {
    mrnRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrn.trim() || !user) return;

    setSubmitting(true);
    try {
      const patientId = await createPatient({
        mrn: mrn.trim(),
        dateOfService,
        patientType,
        clinicalNotes,
        insuranceInfo,
        previousStudies,
        createdBy: user.id,
      });

      processPatient({ patientId });

      setLastSubmitted(mrn.trim());
      handleNextPatient();
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextPatient = () => {
    setMrn("");
    setClinicalNotes("");
    setInsuranceInfo("");
    setPreviousStudies("");
    setPatientType("NEW");
    mrnRef.current?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-blue-600" />
          Patient Authorization Input
        </h1>
        <p className="text-slate-500 mt-1">
          Enter patient information for AI-powered authorization processing
        </p>
      </div>

      {lastSubmitted && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          MRN {lastSubmitted} submitted successfully and is being processed.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Patient Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                MRN *
              </label>
              <input
                ref={mrnRef}
                type="text"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter MRN"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date of Service
              </label>
              <input
                type="date"
                value={dateOfService}
                onChange={(e) => setDateOfService(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Patient Type
              </label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPatientType("NEW")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    patientType === "NEW"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setPatientType("FOLLOWUP")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    patientType === "FOLLOWUP"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Follow-up
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Clinical Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Clinical Notes
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                placeholder="Enter clinical notes, symptoms, diagnoses, referring physician..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Insurance Information
              </label>
              <textarea
                value={insuranceInfo}
                onChange={(e) => setInsuranceInfo(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                placeholder="Enter insurance type (Medicare, Medicare Advantage, Commercial), plan name, ID..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Previous Studies
              </label>
              <textarea
                value={previousStudies}
                onChange={(e) => setPreviousStudies(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                placeholder="List any previous cardiac studies, dates, and findings..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !mrn.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting..." : "Submit & Next"}
          </button>
          <button
            type="button"
            onClick={handleNextPatient}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
