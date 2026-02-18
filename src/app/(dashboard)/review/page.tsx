"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  XCircle,
  Download,
  PauseCircle,
  Clock,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  Sparkles,
  Calendar,
} from "lucide-react";
import { generateReviewSummaryPdf } from "@/lib/generatePdf";
import {
  getSuggestionsForPatient,
  generateQualifyingRationale,
  findScheduledStudy,
  type EligibleSuggestion,
  type StudyType,
} from "@/lib/studySuggestions";

type ReviewStatusFilter = "ALL" | "PENDING" | "APPROVED" | "HELD";

const FEEDBACK_CATEGORIES = [
  { value: "DOCUMENTATION_ISSUE", label: "Documentation Issue" },
  { value: "CLINICAL_REASONING_ERROR", label: "Clinical Reasoning Error" },
  { value: "MISSING_CONTEXT", label: "Missing Context" },
  { value: "RULE_MISAPPLICATION", label: "Rule Misapplication" },
  { value: "INSURANCE_RULE_UPDATE", label: "Insurance Rule Update" },
  { value: "OTHER", label: "Other" },
] as const;

// Parse options from missing field text like "(whether new, recurrent, or worsening)"
function parseOptionsFromMissingField(field: string): { label: string; options: string[] } | null {
  const match = field.match(/\((?:whether\s+)?(.+)\)/i);
  if (!match) return null;

  const label = field.replace(/\s*\(.*\)/, '').trim();
  const optionsText = match[1];
  const options = optionsText
    .split(/,\s*|\s+or\s+/)
    .map(o => o.trim())
    .filter(o => o.length > 0);

  return options.length > 1 ? { label, options } : null;
}

export default function ReviewPage() {
  const { user } = useUser();
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Feedback modal state
  const [feedbackModalPatientId, setFeedbackModalPatientId] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<string>("DOCUMENTATION_ISSUE");
  const [feedbackSuggestedDecision, setFeedbackSuggestedDecision] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackSuggestedRuleUpdate, setFeedbackSuggestedRuleUpdate] = useState("");
  const [holdNotes, setHoldNotes] = useState("");
  const [feedbackOnlyMode, setFeedbackOnlyMode] = useState(false);
  const [reprocessingPatientId, setReprocessingPatientId] = useState<string | null>(null);

  // Qualification suggestion state — maps patientId → studyType → symptom
  const [selectedSymptom, setSelectedSymptom] = useState<Record<string, Record<string, string>>>({});
  const [applyingQualificationId, setApplyingQualificationId] = useState<string | null>(null);

  // Free-text addendum input state — maps "patientId-fieldIndex" → text value
  const [freeTextInputs, setFreeTextInputs] = useState<Record<string, string>>({});


  const providers = useQuery(api.providers.list);
  const clerkProvider = useQuery(
    api.providers.getByClerkUserId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

  // Use Clerk-linked provider if available, otherwise fall back to manual selection
  const resolvedProvider = clerkProvider
    ? clerkProvider
    : providers?.find((p) => p._id === selectedReviewerId) ?? null;

  const grouped = useQuery(api.reviews.listForReview, {
    providerFilter: providerFilter || undefined,
    statusFilter: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const approveMutation = useMutation(api.reviews.approve);
  const holdMutation = useMutation(api.reviews.hold);
  const submitFeedbackMutation = useMutation(api.feedback.submitFeedback);
  const updateRulePerformanceMutation = useMutation(api.feedback.updateRulePerformance);
  const resetForReprocessingMutation = useMutation(api.patients.resetForReprocessing);
  const processPatientAction = useAction(api.processing.processPatient);
  const applyQualifyingSuggestionMutation = useMutation(api.patients.applyQualifyingSuggestion);
  const addAddendumMutation = useMutation(api.patients.addAddendum);

  const handleApprove = async (patientId: Id<"patients">) => {
    if (!resolvedProvider) return;
    await approveMutation({
      patientId,
      reviewerId: resolvedProvider._id,
      reviewerClerkUserId: user?.id || "",
      reviewerName: resolvedProvider.name,
    });
    // Update rule performance — agreed
    // Find the patient to get supporting criteria rule names
    const patientGroups = grouped ? Object.values(grouped).flat() : [];
    const patient = patientGroups.find((p) => p._id === patientId);
    if (patient?.supportingCriteria && patient.supportingCriteria.length > 0) {
      const ruleNames = patient.supportingCriteria.map((sc) => sc.ruleName);
      await updateRulePerformanceMutation({ ruleNames, agreed: true });
    }
  };

  const handleHoldClick = (patientId: string) => {
    setFeedbackModalPatientId(patientId);
    setFeedbackOnlyMode(false);
    setHoldNotes("");
    setFeedbackCategory("DOCUMENTATION_ISSUE");
    setFeedbackSuggestedDecision("");
    setFeedbackNotes("");
    setFeedbackSuggestedRuleUpdate("");
  };

  const handleHoldSubmit = async () => {
    if (!feedbackModalPatientId || !resolvedProvider || !holdNotes.trim()) return;
    const patientId = feedbackModalPatientId as Id<"patients">;

    const reviewId = await holdMutation({
      patientId,
      reviewerId: resolvedProvider._id,
      reviewerClerkUserId: user?.id || "",
      reviewerName: resolvedProvider.name,
      notes: holdNotes,
    });

    // Submit feedback
    await submitFeedbackMutation({
      patientId,
      reviewId,
      reviewerClerkUserId: user?.id || "",
      category: feedbackCategory as any,
      suggestedDecision: feedbackSuggestedDecision || undefined,
      notes: feedbackNotes || holdNotes,
      suggestedRuleUpdate: feedbackSuggestedRuleUpdate || undefined,
    });

    // Update rule performance — disagreed
    const patientGroups = grouped ? Object.values(grouped).flat() : [];
    const patient = patientGroups.find((p) => p._id === patientId);
    if (patient?.supportingCriteria && patient.supportingCriteria.length > 0) {
      const ruleNames = patient.supportingCriteria.map((sc) => sc.ruleName);
      await updateRulePerformanceMutation({ ruleNames, agreed: false });
    }

    setFeedbackModalPatientId(null);
  };

  const handleFeedbackOnlyClick = (patientId: string) => {
    setFeedbackModalPatientId(patientId);
    setFeedbackOnlyMode(true);
    setHoldNotes("");
    setFeedbackCategory("DOCUMENTATION_ISSUE");
    setFeedbackSuggestedDecision("");
    setFeedbackNotes("");
    setFeedbackSuggestedRuleUpdate("");
  };

  const handleFeedbackOnlySubmit = async () => {
    if (!feedbackModalPatientId || !holdNotes.trim()) return;
    const patientId = feedbackModalPatientId as Id<"patients">;

    await submitFeedbackMutation({
      patientId,
      reviewerClerkUserId: user?.id || "",
      category: feedbackCategory as any,
      suggestedDecision: feedbackSuggestedDecision || undefined,
      notes: feedbackNotes || holdNotes,
      suggestedRuleUpdate: feedbackSuggestedRuleUpdate || undefined,
    });

    setFeedbackModalPatientId(null);
    setFeedbackOnlyMode(false);
  };

  const handleReprocess = async (patientId: Id<"patients">) => {
    setReprocessingPatientId(patientId);
    try {
      await resetForReprocessingMutation({ patientId });
      await processPatientAction({ patientId });
    } catch (error) {
      console.error("Reprocessing error:", error);
    } finally {
      setReprocessingPatientId(null);
    }
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

  const handleAddAddendumInline = async (
    patientId: string,
    label: string,
    selectedOption: string,
    originalMissingField: string
  ) => {
    if (!resolvedProvider) return;
    try {
      await addAddendumMutation({
        patientId: patientId as Id<"patients">,
        text: `${label}: ${selectedOption}`,
        addedBy: user?.id || "",
        addedByName: resolvedProvider.name,
        missingFieldToRemove: originalMissingField,
      });
    } catch (error) {
      console.error("Error adding addendum:", error);
    }
  };

  const handleDownloadSummary = () => {
    if (!grouped) return;
    const allPatients = Object.entries(grouped).flatMap(([provider, patients]) =>
      patients.map((p) => ({ ...p, providerGroup: provider }))
    );
    const approvedCount = allPatients.filter((p) => p.review?.reviewStatus === "APPROVED").length;
    const heldCount = allPatients.filter((p) => p.review?.reviewStatus === "HELD").length;

    const doc = generateReviewSummaryPdf({
      providerName: resolvedProvider?.name || "Unknown",
      providerCredentials: (resolvedProvider as any)?.credentials || "",
      approvedCount,
      heldCount,
      patients: allPatients.map((p) => ({
        mrn: p.mrn || p.extractedMrn || "—",
        patientName: p.extractedPatientName || "—",
        dateOfService: p.dateOfService,
        recommendedStudy: formatStudyName(p.recommendedStudy) + ((p as any).secondRecommendedStudy ? ` + ${formatStudyName((p as any).secondRecommendedStudy)}` : ""),
        decision: p.decision || "—",
        reviewStatus: p.review?.reviewStatus || "PENDING",
        rationale: p.rationale || "",
      })),
    });
    doc.save(`review_summary_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const getDecisionBadge = (status: string, decision?: string, recommendedStudy?: string, qualifiedViaSymptom?: boolean) => {
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

  const getReviewBadge = (review: { reviewStatus: string; reviewerName?: string; reviewedAt?: number } | null) => {
    if (!review) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <Clock className="w-3 h-3" />
          Pending Review
        </span>
      );
    }
    if (review.reviewStatus === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          MD Approved
          {review.reviewerName && <span className="text-green-500 ml-1">by {review.reviewerName}</span>}
        </span>
      );
    }
    if (review.reviewStatus === "HELD") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <PauseCircle className="w-3 h-3" />
          Held
          {review.reviewerName && <span className="text-orange-500 ml-1">by {review.reviewerName}</span>}
        </span>
      );
    }
    return null;
  };

  const formatStudyName = (study?: string) => {
    switch (study) {
      case "NUCLEAR": return "Nuclear Stress Test";
      case "STRESS_ECHO": return "Stress Echocardiogram";
      case "ECHO": return "Echocardiogram";
      case "VASCULAR": return "Vascular Study";
      case "NONE": return "No Study Appropriate";
      default: return study || "—";
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-blue-600" />
            Doctor Review
          </h1>
          <p className="text-slate-500 mt-1">
            Review and approve AI-processed authorization decisions
          </p>
        </div>
        {grouped && Object.keys(grouped).length > 0 && (
          <button
            onClick={handleDownloadSummary}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Review Summary
          </button>
        )}
      </div>

      {/* Reviewer selector — shown when user isn't linked to a provider */}
      {!clerkProvider && providers && providers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800 mb-2">
            Your account is not linked to a provider. Select your provider to enable review actions:
          </p>
          <select
            value={selectedReviewerId}
            onChange={(e) => setSelectedReviewerId(e.target.value)}
            className="px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
          >
            <option value="">Select your provider...</option>
            {providers.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.credentials})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Review Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatusFilter)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="HELD">Held</option>
            </select>
          </div>
          {(providerFilter || statusFilter !== "ALL") && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setProviderFilter("");
                  setStatusFilter("ALL");
                }}
                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {grouped === undefined ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500 mt-2">Loading patients for review...</p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No patients pending review</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([provider, patients]) => (
            <div key={provider}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-slate-800">{provider}</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {patients.length} patient{patients.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {patients.map((patient) => {
                  const isExpanded = expandedId === patient._id;
                  return (
                    <div
                      key={patient._id}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : patient._id)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            MRN: {patient.mrn || patient.extractedMrn || "—"}
                          </span>
                          {patient.extractedPatientName && (
                            <span className="text-sm text-slate-500">
                              ({patient.extractedPatientName})
                            </span>
                          )}
                          {getDecisionBadge(patient.status, patient.decision, patient.recommendedStudy, (patient as any).qualifiedViaSymptom)}
                          <span className="text-xs text-slate-400">
                            {formatStudyName(patient.recommendedStudy)}
                            {(patient as any).secondRecommendedStudy && ` + ${formatStudyName((patient as any).secondRecommendedStudy)}`}
                          </span>
                          {patient.recommendedStudy && patient.recommendedStudy !== "NONE" && (() => {
                            const scheduled = findScheduledStudy(patient.clinicalNotes, patient.recommendedStudy as StudyType, patient.dateOfService);
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
                          {getReviewBadge(patient.review)}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">
                            DOS: {patient.dateOfService}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-6 pb-5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {patient.extractedPatientName && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Patient Name</span>
                                <p className="text-sm text-slate-800">{patient.extractedPatientName}</p>
                              </div>
                            )}
                            {patient.extractedDob && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Date of Birth</span>
                                <p className="text-sm text-slate-800">{patient.extractedDob}</p>
                              </div>
                            )}
                            {patient.extractedPhysician && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Physician</span>
                                <p className="text-sm text-slate-800">{patient.extractedPhysician}</p>
                              </div>
                            )}
                            {patient.extractedDiagnoses && patient.extractedDiagnoses.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Diagnoses</span>
                                <p className="text-sm text-slate-800">{patient.extractedDiagnoses.join(", ")}</p>
                              </div>
                            )}
                            {patient.extractedSymptoms && patient.extractedSymptoms.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Symptoms</span>
                                <p className="text-sm text-slate-800">{patient.extractedSymptoms.join(", ")}</p>
                              </div>
                            )}
                          </div>

                          {patient.rationale && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-slate-500">Rationale</span>
                              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                                {patient.rationale}
                              </p>
                            </div>
                          )}

                          {patient.denialReason && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-slate-500">Denial Reason</span>
                              <p className="text-sm text-red-700 mt-1 bg-red-50 p-3 rounded-lg">
                                {patient.denialReason}
                              </p>
                            </div>
                          )}

                          {patient.supportingCriteria && patient.supportingCriteria.length > 0 && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-slate-500">Supporting Criteria</span>
                              <div className="mt-1 space-y-2">
                                {patient.supportingCriteria.map((sc, i) => (
                                  <div key={i} className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                                    <p className="text-xs font-semibold text-blue-800">{sc.ruleName}</p>
                                    <p className="text-sm text-slate-700 mt-0.5">&ldquo;{sc.criterion}&rdquo;</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      <span className="font-medium">Evidence:</span> {sc.clinicalEvidence}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {patient.missingFields && patient.missingFields.length > 0 && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-slate-500">Missing Fields</span>
                              <div className="mt-2 space-y-2">
                                {patient.missingFields.map((field, i) => {
                                  const parsed = parseOptionsFromMissingField(field);
                                  if (parsed) {
                                    return (
                                      <div key={i} className="bg-orange-50 p-3 rounded-lg">
                                        <span className="text-sm text-orange-700">{parsed.label}:</span>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {parsed.options.map((option, j) => (
                                            <button
                                              key={j}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddAddendumInline(patient._id, parsed.label, option, field);
                                              }}
                                              disabled={!resolvedProvider}
                                              className="px-3 py-1 text-sm bg-white border border-orange-300 rounded-full hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {option}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  const inputKey = `${patient._id}-${i}`;
                                  const inputValue = freeTextInputs[inputKey] || "";
                                  return (
                                    <div key={i} className="bg-orange-50 p-3 rounded-lg">
                                      <span className="text-sm text-orange-700">{field}</span>
                                      <div className="flex gap-2 mt-2">
                                        <input
                                          type="text"
                                          value={inputValue}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setFreeTextInputs(prev => ({
                                              ...prev,
                                              [inputKey]: e.target.value
                                            }));
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Type clarification..."
                                          className="flex-1 px-3 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (inputValue.trim()) {
                                              handleAddAddendumInline(patient._id, field, inputValue.trim(), field);
                                              setFreeTextInputs(prev => {
                                                const updated = { ...prev };
                                                delete updated[inputKey];
                                                return updated;
                                              });
                                            }
                                          }}
                                          disabled={!resolvedProvider || !inputValue.trim()}
                                          className="px-4 py-1.5 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Qualification Suggestion Card for DENIED patients */}
                          {patient.status === "COMPLETE" &&
                            (patient.decision === "DENIED" || patient.recommendedStudy === "NONE") &&
                            !(patient as any).qualifiedViaSymptom &&
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
                                              onClick={(e) => {
                                                e.stopPropagation();
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
                                            onClick={(e) => {
                                              e.stopPropagation();
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
                          {(patient as any).qualifiedViaSymptom && (patient as any).qualifyingRationale && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-green-600">Physician Qualification</span>
                              <p className="text-sm text-green-800 mt-1 bg-green-50 p-3 rounded-lg border border-green-200">
                                {(patient as any).qualifyingRationale}
                              </p>
                              <p className="text-xs text-green-600 mt-1 italic">
                                * Study qualified based on physician-confirmed symptom: {(patient as any).qualifyingSymptom}
                              </p>
                              {(patient as any).secondRecommendedStudy && (patient as any).secondQualifyingRationale && (
                                <>
                                  <p className="text-sm text-green-800 mt-2 bg-green-50 p-3 rounded-lg border border-green-200">
                                    {(patient as any).secondQualifyingRationale}
                                  </p>
                                  <p className="text-xs text-green-600 mt-1 italic">
                                    * Study qualified based on physician-confirmed symptom: {(patient as any).secondQualifyingSymptom}
                                  </p>
                                </>
                              )}
                            </div>
                          )}

                          {/* Review info if already reviewed */}
                          {patient.review && patient.review.reviewedAt && (
                            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                              <p className="text-xs text-slate-500">
                                Reviewed by <span className="font-medium text-slate-700">{patient.review.reviewerName || "Unknown"}</span>
                                {" "}on {format(new Date(patient.review.reviewedAt), "MMM d, yyyy h:mm a")}
                              </p>
                              {patient.review.notes && (
                                <p className="text-sm text-slate-700 mt-1">{patient.review.notes}</p>
                              )}
                            </div>
                          )}

                          {/* Addendums */}
                          {(patient as any).addendums && (patient as any).addendums.length > 0 && (
                            <div className="mt-4">
                              <span className="text-xs font-medium text-slate-500">Addendums</span>
                              <div className="mt-2 space-y-2">
                                {(patient as any).addendums.map((addendum: { text: string; addedByName: string; addedAt: number }, idx: number) => (
                                  <div key={idx} className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                    <p className="text-sm text-slate-700">{addendum.text}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {addendum.addedByName} • {format(new Date(addendum.addedAt), "MMM d, yyyy h:mm a")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="mt-4 flex gap-2">
                            {patient.status === "COMPLETE" && (patient.decision === "APPROVED_CLEAN" || patient.decision === "BORDERLINE_NEEDS_LETTER" || patient.decision === "APPROVED_NEEDS_LETTER") && patient.recommendedStudy !== "NONE" && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleApprove(patient._id); }}
                                  disabled={!resolvedProvider}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleHoldClick(patient._id); }}
                                  disabled={!resolvedProvider}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <PauseCircle className="w-4 h-4" />
                                  Hold
                                </button>
                              </>
                            )}
                            {patient.status === "COMPLETE" && (patient.decision === "DENIED" || patient.recommendedStudy === "NONE") && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleFeedbackOnlyClick(patient._id); }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                              >
                                <MessageSquare className="w-4 h-4" />
                                Provide Feedback
                              </button>
                            )}
                            {patient.status === "NEEDS_REVIEW" && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReprocess(patient._id); }}
                                  disabled={reprocessingPatientId === patient._id}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <RefreshCw className={`w-4 h-4 ${reprocessingPatientId === patient._id ? "animate-spin" : ""}`} />
                                  {reprocessingPatientId === patient._id ? "Reprocessing..." : "Reprocess"}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleFeedbackOnlyClick(patient._id); }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Provide Feedback
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackModalPatientId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {feedbackOnlyMode ? "Provide Feedback on Denial" : "Hold Patient \u2014 Provide Feedback"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {feedbackOnlyMode ? "Notes" : "Hold Notes"} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={holdNotes}
                  onChange={(e) => setHoldNotes(e.target.value)}
                  placeholder={feedbackOnlyMode ? "Your feedback on this decision..." : "Why are you holding this patient?"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Feedback Category
                </label>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  What should the decision be?
                </label>
                <select
                  value={feedbackSuggestedDecision}
                  onChange={(e) => setFeedbackSuggestedDecision(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select...</option>
                  <option value="APPROVED_CLEAN">Approved</option>
                  <option value="BORDERLINE_NEEDS_LETTER">Borderline - Needs Letter</option>
                  <option value="DENIED">Denied</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Feedback Notes
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Additional details about what the AI got wrong..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Suggested Rule Update (optional)
                </label>
                <textarea
                  value={feedbackSuggestedRuleUpdate}
                  onChange={(e) => setFeedbackSuggestedRuleUpdate(e.target.value)}
                  placeholder="Suggest changes to authorization rules..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setFeedbackModalPatientId(null); setFeedbackOnlyMode(false); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={feedbackOnlyMode ? handleFeedbackOnlySubmit : handleHoldSubmit}
                disabled={!holdNotes.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  feedbackOnlyMode ? "bg-slate-600 hover:bg-slate-700" : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {feedbackOnlyMode ? "Submit Feedback" : "Submit Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
