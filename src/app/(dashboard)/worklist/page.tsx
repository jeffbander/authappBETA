"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ClipboardList,
  Download,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Calendar,
} from "lucide-react";
import { generateWorklistPdf } from "@/lib/generatePdf";
import {
  getSuggestionsForPatient,
  findScheduledStudy,
} from "@/lib/studySuggestions";

export default function WorklistPage() {
  const [providerFilter, setProviderFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const providers = useQuery(api.providers.list);
  const patients = useQuery(api.patients.list, {
    dateOfServiceFilter: dateFilter || undefined,
    providerFilter: providerFilter || undefined,
  });

  // Get selected provider details
  const selectedProvider = providers?.find((p) => p.name === providerFilter);

  // Filter and categorize patients
  const getWorklistPatients = () => {
    if (!patients || !providerFilter || !dateFilter) return { approved: [], opportunities: [] };

    const approved: typeof patients = [];
    const opportunities: (typeof patients[number] & { suggestions: ReturnType<typeof getSuggestionsForPatient> })[] = [];

    for (const patient of patients) {
      // Check if patient has a recommended study and is not scheduled
      if (
        patient.status === "COMPLETE" &&
        patient.recommendedStudy &&
        patient.recommendedStudy !== "NONE"
      ) {
        const scheduled = findScheduledStudy(patient.clinicalNotes, patient.recommendedStudy);
        if (!scheduled.isScheduled) {
          if (patient.decision === "APPROVED_CLEAN" || patient.decision === "BORDERLINE_NEEDS_LETTER" || patient.decision === "APPROVED_NEEDS_LETTER") {
            approved.push(patient);
          }
        }
      }

      // Check for denied patients with qualification opportunities
      if (
        patient.status === "COMPLETE" &&
        (patient.decision === "DENIED" || patient.recommendedStudy === "NONE") &&
        !(patient as any).qualifiedViaSymptom
      ) {
        const suggestions = getSuggestionsForPatient(
          patient.extractedDiagnoses || [],
          patient.extractedPriorStudies || [],
          patient.dateOfService,
          [...(patient.extractedSymptoms || []), patient.clinicalNotes || ""]
        );
        if (suggestions.length > 0) {
          opportunities.push({ ...patient, suggestions });
        }
      }
    }

    return { approved, opportunities };
  };

  const { approved, opportunities } = getWorklistPatients();
  const hasPatients = approved.length > 0 || opportunities.length > 0;

  const formatStudyName = (study?: string) => {
    switch (study) {
      case "NUCLEAR":
        return "Nuclear Stress Test";
      case "STRESS_ECHO":
        return "Stress Echocardiogram";
      case "ECHO":
        return "Echocardiogram";
      case "VASCULAR":
        return "Vascular Study";
      default:
        return study || "—";
    }
  };

  const handleExportPdf = () => {
    if (!selectedProvider || !dateFilter) return;

    const doc = generateWorklistPdf({
      providerName: selectedProvider.name,
      providerCredentials: selectedProvider.credentials,
      dateOfService: dateFilter,
      approvedPatients: approved.map((p) => ({
        patientName: p.extractedPatientName || "Unknown",
        mrn: p.mrn,
        recommendedStudy: formatStudyName(p.recommendedStudy),
        rationale: p.rationale || "",
      })),
      opportunityPatients: opportunities.map((p) => ({
        patientName: p.extractedPatientName || "Unknown",
        mrn: p.mrn,
        suggestedStudy: formatStudyName(p.suggestions[0]?.suggestion.studyType),
        diagnosis: p.suggestions[0]?.matchingDiagnosis || "",
        suggestedSymptoms: p.suggestions[0]?.suggestion.symptoms || [],
      })),
    });

    doc.save(`worklist_${providerFilter.replace(/\s+/g, "_")}_${dateFilter}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-blue-600" />
          Provider Worklist
        </h1>
        <p className="text-slate-500 mt-1">
          Export unscheduled tests for a provider on a specific date
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Provider
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
            >
              <option value="">Select Provider</option>
              {providers?.map((p) => (
                <option key={p._id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Date of Service
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {hasPatients && (
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!providerFilter || !dateFilter ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Select a provider and date to view the worklist</p>
        </div>
      ) : patients === undefined ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500 mt-2">Loading...</p>
        </div>
      ) : !hasPatients ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-slate-500">No unscheduled tests for this provider on this date</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Approved - Needs Scheduling */}
          {approved.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100">
                <h2 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved - Needs Scheduling ({approved.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {approved.map((patient) => (
                  <div key={patient._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {patient.extractedPatientName || "Unknown"}{" "}
                          <span className="text-slate-500 font-normal">
                            (MRN: {patient.mrn})
                          </span>
                        </p>
                        <p className="text-sm text-green-700 font-medium mt-1">
                          Test: {formatStudyName(patient.recommendedStudy)}
                        </p>
                      </div>
                    </div>
                    {patient.rationale && (
                      <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                        {patient.rationale.length > 200
                          ? patient.rationale.substring(0, 200) + "..."
                          : patient.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities to Schedule */}
          {opportunities.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                <h2 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Opportunities to Schedule ({opportunities.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {opportunities.map((patient) => (
                  <div key={patient._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {patient.extractedPatientName || "Unknown"}{" "}
                          <span className="text-slate-500 font-normal">
                            (MRN: {patient.mrn})
                          </span>
                        </p>
                        <p className="text-sm text-purple-700 font-medium mt-1">
                          Suggested: {formatStudyName(patient.suggestions[0]?.suggestion.studyType)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Based on: {patient.suggestions[0]?.matchingDiagnosis}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="text-xs font-medium text-slate-500">Qualifying symptoms: </span>
                      {patient.suggestions[0]?.suggestion.symptoms.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
