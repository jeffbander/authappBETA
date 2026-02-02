"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { format } from "date-fns";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  XCircle,
} from "lucide-react";
import { generateAttestationPdf } from "@/lib/generatePdf";
import { Id } from "../../../../convex/_generated/dataModel";

type StatusFilter = "" | "PROCESSING" | "COMPLETE" | "NEEDS_REVIEW";
type DecisionFilter = "" | "APPROVED_CLEAN" | "APPROVED_NEEDS_LETTER" | "DENIED";

export default function ResultsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFilter, setDateFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const providers = useQuery(api.providers.list);
  const providersWithSigs = useQuery(api.providers.listWithSignatureUrls);
  const patients = useQuery(api.patients.list, {
    statusFilter: statusFilter || undefined,
    dateOfServiceFilter: dateFilter || undefined,
    providerFilter: providerFilter || undefined,
  });

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPdf = async (patient: NonNullable<typeof patients>[number]) => {
    let signatureDataUrl: string | undefined;
    let providerName: string | undefined;
    let providerCredentials: string | undefined;

    const providerNameToMatch = patient.selectedProvider || patient.extractedPhysician;
    if (providerNameToMatch && providersWithSigs) {
      const match = providersWithSigs.find(
        (p) => p.name === providerNameToMatch
      );
      if (match) {
        providerName = match.name;
        providerCredentials = match.credentials;
        if (match.signatureUrl) {
          try {
            const response = await fetch(match.signatureUrl);
            const blob = await response.blob();
            signatureDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch {
            // Signature fetch failed, continue without it
          }
        }
      }
    }

    const doc = generateAttestationPdf({
      patientName: patient.extractedPatientName || "",
      patientDob: patient.extractedDob || "",
      mrn: patient.mrn,
      dateOfService: patient.dateOfService,
      physician: patient.extractedPhysician || "",
      recommendedStudy: patient.recommendedStudy || "",
      rationale: patient.rationale || "",
      decision: patient.decision || "",
      supportingCriteria: patient.supportingCriteria || undefined,
      signatureDataUrl,
      providerName,
      providerCredentials,
    });
    doc.save(`attestation_${patient.mrn}_${patient.dateOfService}.pdf`);
  };

  const getStatusBadge = (
    status: string,
    decision?: string
  ) => {
    if (status === "PROCESSING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    }
    if (status === "NEEDS_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <AlertCircle className="w-3 h-3" />
          Needs Review
        </span>
      );
    }
    switch (decision) {
      case "APPROVED_CLEAN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case "APPROVED_NEEDS_LETTER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <FileWarning className="w-3 h-3" />
            Needs Letter
          </span>
        );
      case "DENIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Denied
          </span>
        );
      default:
        return null;
    }
  };

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
      case "NONE":
        return "No Study Appropriate";
      default:
        return study || "—";
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-blue-600" />
          Authorization Results
        </h1>
        <p className="text-slate-500 mt-1">
          View real-time authorization decisions and download attestation
          letters
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETE">Complete</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Provider
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Providers</option>
              {providers?.map((p) => (
                <option key={p._id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {(statusFilter || dateFilter || providerFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter("");
                  setDateFilter("");
                  setProviderFilter("");
                }}
                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      {patients === undefined ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500 mt-2">Loading results...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No results found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => {
            const isExpanded = expandedId === patient._id;
            return (
              <div
                key={patient._id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : patient._id)
                  }
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm font-semibold text-slate-900">
                        MRN: {patient.mrn}
                      </span>
                      {patient.extractedPatientName && (
                        <span className="text-sm text-slate-500 ml-2">
                          ({patient.extractedPatientName})
                        </span>
                      )}
                    </div>
                    {getStatusBadge(patient.status, patient.decision)}
                    <span className="text-xs text-slate-400">
                      DOS: {patient.dateOfService}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatStudyName(patient.recommendedStudy)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {format(new Date(patient.createdAt), "MMM d, h:mm a")}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {patient.extractedPatientName && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Patient Name
                          </span>
                          <p className="text-sm text-slate-800">
                            {patient.extractedPatientName}
                          </p>
                        </div>
                      )}
                      {patient.extractedDob && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Date of Birth
                          </span>
                          <p className="text-sm text-slate-800">
                            {patient.extractedDob}
                          </p>
                        </div>
                      )}
                      {patient.extractedPhysician && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Physician
                          </span>
                          <p className="text-sm text-slate-800">
                            {patient.extractedPhysician}
                          </p>
                        </div>
                      )}
                      {patient.extractedDiagnoses &&
                        patient.extractedDiagnoses.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-slate-500">
                              Diagnoses
                            </span>
                            <p className="text-sm text-slate-800">
                              {patient.extractedDiagnoses.join(", ")}
                            </p>
                          </div>
                        )}
                      {patient.extractedSymptoms &&
                        patient.extractedSymptoms.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-slate-500">
                              Symptoms
                            </span>
                            <p className="text-sm text-slate-800">
                              {patient.extractedSymptoms.join(", ")}
                            </p>
                          </div>
                        )}
                    </div>

                    {patient.rationale && (
                      <div className="mt-4">
                        <span className="text-xs font-medium text-slate-500">
                          Rationale
                        </span>
                        <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                          {patient.rationale}
                        </p>
                      </div>
                    )}

                    {patient.denialReason && (
                      <div className="mt-4">
                        <span className="text-xs font-medium text-slate-500">
                          Denial Reason
                        </span>
                        <p className="text-sm text-red-700 mt-1 bg-red-50 p-3 rounded-lg">
                          {patient.denialReason}
                        </p>
                      </div>
                    )}

                    {patient.supportingCriteria &&
                      patient.supportingCriteria.length > 0 && (
                        <div className="mt-4">
                          <span className="text-xs font-medium text-slate-500">
                            Supporting Criteria
                          </span>
                          <div className="mt-1 space-y-2">
                            {patient.supportingCriteria.map((sc, i) => (
                              <div
                                key={i}
                                className="bg-blue-50 border border-blue-100 p-3 rounded-lg"
                              >
                                <p className="text-xs font-semibold text-blue-800">
                                  {sc.ruleName}
                                </p>
                                <p className="text-sm text-slate-700 mt-0.5">
                                  &ldquo;{sc.criterion}&rdquo;
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  <span className="font-medium">Evidence:</span>{" "}
                                  {sc.clinicalEvidence}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {patient.missingFields &&
                      patient.missingFields.length > 0 && (
                        <div className="mt-4">
                          <span className="text-xs font-medium text-slate-500">
                            Missing Fields
                          </span>
                          <ul className="text-sm text-orange-700 mt-1 bg-orange-50 p-3 rounded-lg list-disc list-inside">
                            {patient.missingFields.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    <div className="mt-4 flex gap-2">
                      {patient.rationale && (
                        <button
                          onClick={() =>
                            handleCopy(patient.rationale!, patient._id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          {copiedId === patient._id ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Rationale
                            </>
                          )}
                        </button>
                      )}
                      {patient.status === "COMPLETE" && patient.decision && (
                        <button
                          onClick={() => handleDownloadPdf(patient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
