"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
  Lightbulb,
  Sparkles,
  FileText,
  Calendar,
} from "lucide-react";
import { generateAttestationPdf } from "@/lib/generatePdf";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  getSuggestionsForPatient,
  generateQualifyingRationale,
  type EligibleSuggestion,
} from "@/lib/studySuggestions";

type StatusFilter = "" | "PROCESSING" | "COMPLETE" | "NEEDS_REVIEW";
type DecisionFilter = "" | "APPROVED_CLEAN" | "APPROVED_NEEDS_LETTER" | "DENIED";

export default function ResultsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFilter, setDateFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Qualification suggestion state — maps patientId → studyType → symptom
  const [selectedSymptom, setSelectedSymptom] = useState<Record<string, Record<string, string>>>({});
  const [applyingQualificationId, setApplyingQualificationId] = useState<string | null>(null);

  const applyQualifyingSuggestionMutation = useMutation(api.patients.applyQualifyingSuggestion);

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
      const normalizedInput = providerNameToMatch.toLowerCase().replace(/[^a-z]/g, "");
      const match = providersWithSigs.find((p) => {
        const normalizedProvider = p.name.toLowerCase().replace(/[^a-z]/g, "");
        return (
          normalizedProvider === normalizedInput ||
          normalizedInput.includes(normalizedProvider) ||
          normalizedProvider.includes(normalizedInput)
        );
      });
      if (match) {
        providerName = match.name;
        providerCredentials = match.credentials;
        if (match.signatureUrl) {
          try {
            signatureDataUrl = await new Promise<string>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
              };
              img.onerror = reject;
              img.src = match.signatureUrl!;
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
      qualifiedViaSymptom: patient.qualifiedViaSymptom,
      qualifyingRationale: patient.qualifyingRationale,
      secondRecommendedStudy: patient.secondRecommendedStudy || undefined,
      secondQualifyingRationale: patient.secondQualifyingRationale || undefined,
    });
    doc.save(`attestation_${patient.mrn}_${patient.dateOfService}.pdf`);
  };

  const handleApplyQualification = async (
    patientId: Id<"patients">,
    suggestions: EligibleSuggestion[],
    symptoms: Record<string, string>
  ) => {
    const selectedStudies = suggestions.filter(s => symptoms[s.suggestion.studyType]);
    if (selectedStudies.length === 0) return;

    setApplyingQualificationId(patientId);
    try {
      const primary = selectedStudies[0];
      const primarySymptom = symptoms[primary.suggestion.studyType];
      const second = selectedStudies.length > 1 ? selectedStudies[1] : null;
      const secondSymptom = second ? symptoms[second.suggestion.studyType] : undefined;

      await applyQualifyingSuggestionMutation({
        patientId,
        symptom: primarySymptom,
        studyType: primary.suggestion.studyType,
        qualifyingRationale: generateQualifyingRationale(
          primarySymptom,
          primary.matchingDiagnosis,
          primary.suggestion.studyName
        ),
        ...(second && secondSymptom ? {
          secondStudyType: second.suggestion.studyType,
          secondSymptom,
          secondQualifyingRationale: generateQualifyingRationale(
            secondSymptom,
            second.matchingDiagnosis,
            second.suggestion.studyName
          ),
        } : {}),
      });
      setSelectedSymptom((prev) => {
        const updated = { ...prev };
        delete updated[patientId];
        return updated;
      });
    } catch (error) {
      console.error("Error applying qualification:", error);
    } finally {
      setApplyingQualificationId(null);
    }
  };

  const getStatusBadge = (
    status: string,
    decision?: string,
    recommendedStudy?: string,
    qualifiedViaSymptom?: boolean
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
    // Treat "no study appropriate" as denied regardless of AI decision
    if (recommendedStudy === "NONE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" />
          Denied
        </span>
      );
    }
    // Show starred badge for symptom-qualified approvals
    if (qualifiedViaSymptom) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <Sparkles className="w-3 h-3" />
          Test Identified*
        </span>
      );
    }
    switch (decision) {
      case "APPROVED_CLEAN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" />
            Test Identified
          </span>
        );
      case "APPROVED_NEEDS_LETTER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <FileWarning className="w-3 h-3" />
            Test Identified - Needs Letter
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
                    {getStatusBadge(patient.status, patient.decision, patient.recommendedStudy, patient.qualifiedViaSymptom)}
                    {patient.referralPdfStorageId && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <FileText className="w-3 h-3" />
                        PDF Referral
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      DOS: {patient.dateOfService}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatStudyName(patient.recommendedStudy)}
                      {patient.secondRecommendedStudy && ` + ${formatStudyName(patient.secondRecommendedStudy)}`}
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

                    {/* Qualification Suggestion Card for DENIED patients */}
                    {patient.status === "COMPLETE" &&
                      (patient.decision === "DENIED" || patient.recommendedStudy === "NONE") &&
                      !patient.qualifiedViaSymptom &&
                      (() => {
                        const suggestions = getSuggestionsForPatient(
                          patient.extractedDiagnoses || [],
                          patient.extractedPriorStudies || [],
                          patient.dateOfService,
                          [...(patient.extractedSymptoms || []), patient.clinicalNotes || ""]
                        );
                        if (suggestions.length === 0) return null;
                        const patientSymptoms = selectedSymptom[patient._id] || {};
                        const hasAnySymptom = Object.values(patientSymptoms).some(Boolean);

                        // Separate suggestions into scheduled vs new
                        const scheduledSuggestions = suggestions.filter(s => s.isAlreadyScheduled);
                        const newSuggestions = suggestions.filter(s => !s.isAlreadyScheduled);

                        return (
                          <div className="mt-4 space-y-4">
                            {/* Scheduled Test Review - Blue styling */}
                            {scheduledSuggestions.length > 0 && (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                  <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-blue-800">
                                      Scheduled Test Review
                                    </h4>
                                    {scheduledSuggestions.map((suggestion, idx) => (
                                      <div key={suggestion.suggestion.studyType} className={idx > 0 ? "mt-4 pt-4 border-t border-blue-200" : "mt-1"}>
                                        <p className="text-sm text-blue-700">
                                          A <span className="font-medium">{suggestion.suggestion.studyName}</span> is already scheduled.
                                          Based on patient&apos;s history of <span className="font-medium">{suggestion.matchingDiagnosis}</span>,
                                          confirm qualifying symptoms to proceed.
                                        </p>
                                        {suggestion.scheduledContext && (
                                          <p className="text-xs text-blue-600 mt-1 italic">
                                            Found in notes: &quot;{suggestion.scheduledContext}&quot;
                                          </p>
                                        )}
                                        <div className="mt-2">
                                          <p className="text-xs font-medium text-blue-800 mb-1.5">
                                            Select symptom for {suggestion.suggestion.studyName}:
                                          </p>
                                          <div className="space-y-1.5">
                                            {suggestion.suggestion.symptoms.map((symptom) => (
                                              <label key={symptom} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`symptom-${patient._id}-${suggestion.suggestion.studyType}`}
                                                  value={symptom}
                                                  checked={patientSymptoms[suggestion.suggestion.studyType] === symptom}
                                                  onChange={(e) => setSelectedSymptom((prev) => ({
                                                    ...prev,
                                                    [patient._id]: {
                                                      ...(prev[patient._id] || {}),
                                                      [suggestion.suggestion.studyType]: e.target.value,
                                                    },
                                                  }))}
                                                  className="w-4 h-4 text-blue-600 border-blue-300 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-blue-900 capitalize">{symptom}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {newSuggestions.length === 0 && (
                                      <button
                                        onClick={() => {
                                          if (hasAnySymptom) {
                                            handleApplyQualification(patient._id, suggestions, patientSymptoms);
                                          }
                                        }}
                                        disabled={!hasAnySymptom || applyingQualificationId === patient._id}
                                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {applyingQualificationId === patient._id ? (
                                          <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Applying...
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Confirm &amp; Update Status
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Opportunity to Schedule - Purple styling */}
                            {newSuggestions.length > 0 && (
                              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                  <Lightbulb className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-purple-800">
                                      Opportunity to Schedule
                                    </h4>
                                    {newSuggestions.map((suggestion, idx) => (
                                      <div key={suggestion.suggestion.studyType} className={idx > 0 ? "mt-4 pt-4 border-t border-purple-200" : "mt-1"}>
                                        <p className="text-sm text-purple-700">
                                          Based on patient&apos;s history of <span className="font-medium">{suggestion.matchingDiagnosis}</span>,
                                          a <span className="font-medium">{suggestion.suggestion.studyName}</span> may
                                          be appropriate if patient has qualifying symptoms.
                                        </p>
                                        <div className="mt-2">
                                          <p className="text-xs font-medium text-purple-800 mb-1.5">
                                            Select symptom for {suggestion.suggestion.studyName}:
                                          </p>
                                          <div className="space-y-1.5">
                                            {suggestion.suggestion.symptoms.map((symptom) => (
                                              <label key={symptom} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`symptom-${patient._id}-${suggestion.suggestion.studyType}`}
                                                  value={symptom}
                                                  checked={patientSymptoms[suggestion.suggestion.studyType] === symptom}
                                                  onChange={(e) => setSelectedSymptom((prev) => ({
                                                    ...prev,
                                                    [patient._id]: {
                                                      ...(prev[patient._id] || {}),
                                                      [suggestion.suggestion.studyType]: e.target.value,
                                                    },
                                                  }))}
                                                  className="w-4 h-4 text-purple-600 border-purple-300 focus:ring-purple-500"
                                                />
                                                <span className="text-sm text-purple-900 capitalize">{symptom}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        if (hasAnySymptom) {
                                          handleApplyQualification(patient._id, suggestions, patientSymptoms);
                                        }
                                      }}
                                      disabled={!hasAnySymptom || applyingQualificationId === patient._id}
                                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {applyingQualificationId === patient._id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Applying...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-4 h-4" />
                                          Apply &amp; Update Status
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* Show qualifying rationale if patient was qualified via symptom */}
                    {patient.qualifiedViaSymptom && patient.qualifyingRationale && (
                      <div className="mt-4">
                        <span className="text-xs font-medium text-green-600">Physician Qualification</span>
                        <p className="text-sm text-green-800 mt-1 bg-green-50 p-3 rounded-lg border border-green-200">
                          {patient.qualifyingRationale}
                        </p>
                        <p className="text-xs text-green-600 mt-1 italic">
                          * Study qualified based on physician-confirmed symptom: {patient.qualifyingSymptom}
                        </p>
                        {patient.secondRecommendedStudy && patient.secondQualifyingRationale && (
                          <>
                            <p className="text-sm text-green-800 mt-2 bg-green-50 p-3 rounded-lg border border-green-200">
                              {patient.secondQualifyingRationale}
                            </p>
                            <p className="text-xs text-green-600 mt-1 italic">
                              * Study qualified based on physician-confirmed symptom: {patient.secondQualifyingSymptom}
                            </p>
                          </>
                        )}
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
