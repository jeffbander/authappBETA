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
  MessageSquare,
  Phone,
  Send,
  X,
} from "lucide-react";
import { generateAttestationPdf } from "@/lib/generatePdf";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  getSuggestionsForPatient,
  generateQualifyingRationale,
  findScheduledStudy,
  type EligibleSuggestion,
} from "@/lib/studySuggestions";
import {
  getJustificationsForReason,
  detectNeedsLetterReason,
  formatReasonDisplay,
  getAllJustificationsForStudyType,
  type NeedsLetterReason,
} from "@/lib/letterJustifications";

type StatusFilter = "" | "PROCESSING" | "COMPLETE" | "NEEDS_REVIEW";
type DecisionFilter = "" | "APPROVED_CLEAN" | "BORDERLINE_NEEDS_LETTER" | "DENIED";

function SurveyStatusBadge({ patientId }: { patientId: Id<"patients"> }) {
  const survey = useQuery(api.smsSurveys.getByPatientId, { patientId });
  if (!survey) return null;

  switch (survey.status) {
    case "IN_PROGRESS":
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <MessageSquare className="w-3 h-3" />
          Survey In Progress
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
          <CheckCircle2 className="w-3 h-3" />
          Survey Complete
        </span>
      );
    case "EXPIRED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          <MessageSquare className="w-3 h-3" />
          Survey Expired
        </span>
      );
    case "OPTED_OUT":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          <MessageSquare className="w-3 h-3" />
          Opted Out
        </span>
      );
    default:
      return null;
  }
}

function SurveySection({
  patientId,
  smsSurveyId,
  surveyModalPatientId,
  setSurveyModalPatientId,
  surveyPhone,
  setSurveyPhone,
  sendingSurvey,
  surveyError,
  surveySuccess,
  handleSendSurvey,
}: {
  patientId: Id<"patients">;
  smsSurveyId?: Id<"smsSurveys">;
  surveyModalPatientId: string | null;
  setSurveyModalPatientId: (id: string | null) => void;
  surveyPhone: string;
  setSurveyPhone: (phone: string) => void;
  sendingSurvey: boolean;
  surveyError: string | null;
  surveySuccess: string | null;
  handleSendSurvey: (patientId: string) => void;
}) {
  const survey = useQuery(api.smsSurveys.getByPatientId, { patientId });
  const cancelSurveyMutation = useMutation(api.smsSurveys.cancelSurvey);
  const [cancelling, setCancelling] = useState(false);
  const isModalOpen = surveyModalPatientId === patientId;
  const hasActiveSurvey = survey && (survey.status === "PENDING" || survey.status === "IN_PROGRESS");
  const hasCompletedSurvey = survey && survey.status === "COMPLETED";

  return (
    <div className="mt-4">
      {/* Send Survey button or status */}
      {!hasActiveSurvey && !hasCompletedSurvey && (
        <div>
          {isModalOpen ? (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-teal-800 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Send Symptom Survey
                </h4>
                <button
                  onClick={() => {
                    setSurveyModalPatientId(null);
                    setSurveyPhone("");
                  }}
                  className="text-teal-400 hover:text-teal-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={surveyPhone}
                  onChange={(e) => setSurveyPhone(e.target.value)}
                  placeholder="Patient phone (e.g., 2125551234)"
                  className="flex-1 px-3 py-2 text-sm border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <button
                  onClick={() => handleSendSurvey(patientId)}
                  disabled={sendingSurvey || !surveyPhone.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingSurvey ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </button>
              </div>
              {surveyError && (
                <p className="text-xs text-red-600 mt-2">{surveyError}</p>
              )}
              {surveySuccess && (
                <p className="text-xs text-green-600 mt-2">{surveySuccess}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSurveyModalPatientId(patientId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Send Symptom Survey
            </button>
          )}
        </div>
      )}

      {/* Active survey status */}
      {hasActiveSurvey && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Survey in progress — sent to {survey.phoneNumber}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Question {Math.min(survey.currentQuestionIndex + 1, survey.questions.length)} of{" "}
                {survey.questions.length} — Sent by {survey.initiatedByName},{" "}
                {format(new Date(survey.createdAt), "MMM d, h:mm a")}
              </p>
            </div>
            <button
              onClick={async () => {
                setCancelling(true);
                try {
                  await cancelSurveyMutation({ surveyId: survey._id });
                } catch (err) {
                  console.error("Failed to cancel survey:", err);
                } finally {
                  setCancelling(false);
                }
              }}
              disabled={cancelling}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {cancelling ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Completed survey results */}
      {hasCompletedSurvey && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <h4 className="text-sm font-semibold text-teal-800 flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4" />
            Patient-Reported Symptoms (SMS Survey)
          </h4>
          <p className="text-xs text-teal-600 mb-3">
            Completed {survey.completedAt ? format(new Date(survey.completedAt), "MMM d, h:mm a") : "—"}
            {" "}&bull; Sent by {survey.initiatedByName}
          </p>
          <div className="space-y-1">
            {survey.questions.map((q) => {
              if (q.answeredYes === undefined) return null;
              return (
                <div key={q.questionId} className="flex items-center gap-2 text-sm">
                  {q.answeredYes ? (
                    <>
                      <span className="text-red-600 font-medium">+</span>
                      <span className="text-slate-800">
                        {q.medicalTerm}
                        {q.followUpAnsweredYes !== undefined && (
                          <span className={q.followUpAnsweredYes ? "text-red-600 font-medium ml-1" : "text-slate-500 ml-1"}>
                            ({q.followUpAnsweredYes ? "NEW/WORSENING" : "stable"})
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-600 font-medium">-</span>
                      <span className="text-slate-500">{q.medicalTerm}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFilter, setDateFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Qualification suggestion state — maps patientId → studyType → symptom
  const [selectedSymptom, setSelectedSymptom] = useState<Record<string, Record<string, string>>>({});
  const [applyingQualificationId, setApplyingQualificationId] = useState<string | null>(null);

  // Attestation letter justification state — maps patientId → selected justifications
  const [letterJustifications, setLetterJustifications] = useState<Record<string, Set<string>>>({});
  const [letterOtherText, setLetterOtherText] = useState<Record<string, string>>({});
  const [letterOtherChecked, setLetterOtherChecked] = useState<Record<string, boolean>>({});
  const [savingJustificationsId, setSavingJustificationsId] = useState<string | null>(null);

  // Provider reassignment state
  const [pendingProvider, setPendingProvider] = useState<Record<string, string>>({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);

  // SMS Survey state
  const [surveyModalPatientId, setSurveyModalPatientId] = useState<string | null>(null);
  const [surveyPhone, setSurveyPhone] = useState("");
  const [sendingSurvey, setSendingSurvey] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveySuccess, setSurveySuccess] = useState<string | null>(null);

  const applyQualifyingSuggestionMutation = useMutation(api.patients.applyQualifyingSuggestion);
  const saveLetterJustificationsMutation = useMutation(api.patients.saveLetterJustifications);
  const updateProviderMutation = useMutation(api.patients.updateProvider);

  const providers = useQuery(api.providers.list);
  const providersWithSigs = useQuery(api.providers.listWithSignatureUrls);

  const findMatchingProvider = (extractedName: string | undefined) => {
    if (!extractedName || !providers) return "";
    const normalizedInput = extractedName.toLowerCase().replace(/[^a-z]/g, "");
    const match = providers.find((p) => {
      const normalizedProvider = p.name.toLowerCase().replace(/[^a-z]/g, "");
      return (
        normalizedProvider === normalizedInput ||
        normalizedInput.includes(normalizedProvider) ||
        normalizedProvider.includes(normalizedInput)
      );
    });
    return match ? match.name : "";
  };
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

  const handleSaveLetterJustifications = async (patientId: Id<"patients">) => {
    const selected = letterJustifications[patientId] || new Set();
    const otherChecked = letterOtherChecked[patientId] || false;
    const otherText = letterOtherText[patientId]?.trim() || "";

    // Validation: need at least one selection or other text
    if (selected.size === 0 && (!otherChecked || !otherText)) {
      return;
    }

    setSavingJustificationsId(patientId);
    try {
      await saveLetterJustificationsMutation({
        patientId,
        justifications: Array.from(selected),
        otherText: otherChecked && otherText ? otherText : undefined,
        confirmedBy: "current-user", // TODO: Get from auth context if available
      });
      // Clear local state after successful save
      setLetterJustifications((prev) => {
        const updated = { ...prev };
        delete updated[patientId];
        return updated;
      });
      setLetterOtherText((prev) => {
        const updated = { ...prev };
        delete updated[patientId];
        return updated;
      });
      setLetterOtherChecked((prev) => {
        const updated = { ...prev };
        delete updated[patientId];
        return updated;
      });
    } catch (error) {
      console.error("Error saving letter justifications:", error);
    } finally {
      setSavingJustificationsId(null);
    }
  };

  const toggleLetterJustification = (patientId: string, justification: string) => {
    setLetterJustifications((prev) => {
      const current = prev[patientId] || new Set<string>();
      const updated = new Set(current);
      if (updated.has(justification)) {
        updated.delete(justification);
      } else {
        updated.add(justification);
      }
      return { ...prev, [patientId]: updated };
    });
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
      mrn: patient.mrn || patient.extractedMrn || "",
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
      addendums: patient.addendums,
      // Attestation letter justification fields
      needsLetterReason: patient.needsLetterReason || undefined,
      letterJustifications: patient.letterJustifications || undefined,
      letterJustificationOther: patient.letterJustificationOther || undefined,
    });
    doc.save(`attestation_${patient.mrn || patient.extractedMrn || "unknown"}_${patient.dateOfService}.pdf`);
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

  const handleSendSurvey = async (patientId: string) => {
    if (!surveyPhone.trim()) return;
    setSendingSurvey(true);
    setSurveyError(null);
    setSurveySuccess(null);
    try {
      const res = await fetch("/api/send-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          phoneNumber: surveyPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSurveyError(data.error || "Failed to send survey");
      } else {
        setSurveySuccess("Survey sent successfully!");
        setSurveyPhone("");
        setTimeout(() => {
          setSurveyModalPatientId(null);
          setSurveySuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      setSurveyError(err.message || "Network error");
    } finally {
      setSendingSurvey(false);
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
      case "BORDERLINE_NEEDS_LETTER":
      case "APPROVED_NEEDS_LETTER": // Backwards compatibility
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <FileWarning className="w-3 h-3" />
            Borderline - Needs Letter
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
                        MRN: {patient.mrn || patient.extractedMrn || "—"}
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
                    {patient.smsSurveyId && (
                      <SurveyStatusBadge patientId={patient._id} />
                    )}
                    <span className="text-xs text-slate-400">
                      DOS: {patient.dateOfService}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatStudyName(patient.recommendedStudy)}
                      {patient.secondRecommendedStudy && ` + ${formatStudyName(patient.secondRecommendedStudy)}`}
                    </span>
                    {patient.recommendedStudy && patient.recommendedStudy !== "NONE" && (() => {
                      const scheduled = findScheduledStudy(patient.clinicalNotes, patient.recommendedStudy, patient.dateOfService);
                      return scheduled.isScheduled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Calendar className="w-3 h-3" />
                          Scheduled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          Not Yet Scheduled
                        </span>
                      );
                    })()}
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
                      <div>
                        <span className="text-xs font-medium text-slate-500">
                          Physician
                        </span>
                        {(!patient.selectedProvider || patient.selectedProvider === "Other") ? (
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              className="text-sm border border-amber-300 bg-amber-50 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={pendingProvider[patient._id] ?? findMatchingProvider(patient.extractedPhysician)}
                              onChange={(e) =>
                                setPendingProvider((prev) => ({
                                  ...prev,
                                  [patient._id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select provider...</option>
                              {providers?.map((p) => (
                                <option key={p._id} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={
                                !pendingProvider[patient._id] ||
                                savingProviderId === patient._id
                              }
                              onClick={async () => {
                                setSavingProviderId(patient._id);
                                try {
                                  await updateProviderMutation({
                                    patientId: patient._id,
                                    selectedProvider: pendingProvider[patient._id],
                                  });
                                  setPendingProvider((prev) => {
                                    const updated = { ...prev };
                                    delete updated[patient._id];
                                    return updated;
                                  });
                                } finally {
                                  setSavingProviderId(null);
                                }
                              }}
                            >
                              {savingProviderId === patient._id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </button>
                            {patient.extractedPhysician && (
                              <span className="text-xs text-slate-400">
                                (extracted: {patient.extractedPhysician})
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-800">
                            {patient.selectedProvider}
                          </p>
                        )}
                      </div>
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

                    {/* Attestation Letter Justification Section for BORDERLINE_NEEDS_LETTER */}
                    {patient.status === "COMPLETE" &&
                      (patient.decision === "BORDERLINE_NEEDS_LETTER" || patient.decision === "APPROVED_NEEDS_LETTER") &&
                      (() => {
                        // Auto-detect or use stored reason
                        const reason = (patient.needsLetterReason ||
                          detectNeedsLetterReason(
                            patient.recommendedStudy,
                            patient.supportingCriteria
                          )) as NeedsLetterReason | null;

                        // Get justification options - fallback to all options for study type if reason not detected
                        let justificationOptions: string[];
                        let displayReason: string;

                        if (reason) {
                          const category = getJustificationsForReason(reason);
                          if (category) {
                            justificationOptions = category.justificationOptions;
                            displayReason = formatReasonDisplay(reason);
                          } else {
                            justificationOptions = getAllJustificationsForStudyType(patient.recommendedStudy);
                            displayReason = "Borderline case requiring justification";
                          }
                        } else {
                          // Fallback: show ALL options for this study type
                          justificationOptions = getAllJustificationsForStudyType(patient.recommendedStudy);
                          displayReason = "Borderline case requiring justification";
                        }

                        const isAlreadyConfirmed = !!patient.letterJustificationsConfirmedAt;
                        const patientSelected = letterJustifications[patient._id] || new Set<string>();
                        const patientOtherChecked = letterOtherChecked[patient._id] || false;
                        const patientOtherText = letterOtherText[patient._id] || "";
                        const canSubmit =
                          patientSelected.size > 0 ||
                          (patientOtherChecked && patientOtherText.trim().length > 0);

                        return (
                          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                            <div className="flex items-start gap-3">
                              <FileWarning className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-yellow-800">
                                  Attestation Letter Required
                                </h4>
                                <p className="text-sm text-yellow-700 mt-1">
                                  Reason:{" "}
                                  <span className="font-medium">
                                    {displayReason}
                                  </span>
                                </p>

                                {isAlreadyConfirmed ? (
                                  // Show confirmed state
                                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4" />
                                      Justifications Confirmed
                                    </p>
                                    <ul className="mt-2 space-y-1">
                                      {patient.letterJustifications?.map((j, i) => (
                                        <li key={i} className="text-sm text-green-700">
                                          • {j}
                                        </li>
                                      ))}
                                      {patient.letterJustificationOther && (
                                        <li className="text-sm text-green-700">
                                          • Other: {patient.letterJustificationOther}
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                ) : (
                                  // Show selection UI
                                  <div className="mt-3 space-y-2">
                                    <p className="text-xs font-medium text-yellow-800">
                                      Select applicable justifications (at least one required):
                                    </p>
                                    <div className="space-y-2">
                                      {justificationOptions.map((option) => (
                                        <label
                                          key={option}
                                          className="flex items-start gap-2 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={patientSelected.has(option)}
                                            onChange={() =>
                                              toggleLetterJustification(patient._id, option)
                                            }
                                            className="mt-0.5 w-4 h-4 text-yellow-600 border-yellow-300 rounded focus:ring-yellow-500"
                                          />
                                          <span className="text-sm text-yellow-900">{option}</span>
                                        </label>
                                      ))}
                                      <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={patientOtherChecked}
                                          onChange={(e) =>
                                            setLetterOtherChecked((prev) => ({
                                              ...prev,
                                              [patient._id]: e.target.checked,
                                            }))
                                          }
                                          className="mt-0.5 w-4 h-4 text-yellow-600 border-yellow-300 rounded focus:ring-yellow-500"
                                        />
                                        <span className="text-sm text-yellow-900">Other</span>
                                      </label>
                                      {patientOtherChecked && (
                                        <textarea
                                          value={patientOtherText}
                                          onChange={(e) =>
                                            setLetterOtherText((prev) => ({
                                              ...prev,
                                              [patient._id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Please specify..."
                                          className="w-full ml-6 px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                                          rows={2}
                                        />
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleSaveLetterJustifications(patient._id)}
                                      disabled={!canSubmit || savingJustificationsId === patient._id}
                                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {savingJustificationsId === patient._id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="w-4 h-4" />
                                          Confirm Justifications
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    {/* SMS Survey Section */}
                    <SurveySection
                      patientId={patient._id}
                      smsSurveyId={patient.smsSurveyId}
                      surveyModalPatientId={surveyModalPatientId}
                      setSurveyModalPatientId={setSurveyModalPatientId}
                      surveyPhone={surveyPhone}
                      setSurveyPhone={setSurveyPhone}
                      sendingSurvey={sendingSurvey}
                      surveyError={surveyError}
                      surveySuccess={surveySuccess}
                      handleSendSurvey={handleSendSurvey}
                    />

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
                        (patient.decision === "BORDERLINE_NEEDS_LETTER" || patient.decision === "APPROVED_NEEDS_LETTER") && !patient.letterJustificationsConfirmedAt ? (
                          <span className="text-xs text-yellow-600 italic flex items-center gap-1">
                            <FileWarning className="w-3 h-3" />
                            Confirm justifications above to download PDF
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDownloadPdf(patient)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Download PDF
                          </button>
                        )
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
