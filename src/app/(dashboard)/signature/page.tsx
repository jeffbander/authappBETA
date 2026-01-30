"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { PenTool, Save, Trash2, Check } from "lucide-react";

export default function SignaturePage() {
  const { user } = useUser();
  const sigRef = useRef<SignatureCanvas>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const provider = useQuery(
    api.providers.getByClerkUserId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );
  const generateUploadUrl = useMutation(api.providers.generateUploadUrl);
  const saveSignature = useMutation(api.providers.saveSignature);
  const signatureUrl = useQuery(
    api.providers.getSignatureUrl,
    provider?.signatureStorageId
      ? { storageId: provider.signatureStorageId }
      : "skip"
  );

  const handleClear = () => {
    sigRef.current?.clear();
    setSaved(false);
  };

  const handleSave = async () => {
    if (!sigRef.current || sigRef.current.isEmpty() || !provider) return;

    setSaving(true);
    try {
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      const blob = await fetch(dataUrl).then((r) => r.blob());

      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const { storageId } = await result.json();

      await saveSignature({
        providerId: provider._id,
        signatureStorageId: storageId,
      });

      setSaved(true);
    } catch (error) {
      console.error("Failed to save signature:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-500">Loading...</div>
    );
  }

  if (provider === undefined) {
    return (
      <div className="text-center py-12 text-slate-500">Loading...</div>
    );
  }

  if (provider === null) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-4">
          <PenTool className="w-7 h-7 text-blue-600" />
          Signature Setup
        </h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <p className="text-yellow-800">
            No provider profile found for your account. Please ask an
            administrator to create your provider profile in the Admin
            &gt; Providers section and link it to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <PenTool className="w-7 h-7 text-blue-600" />
          Signature Setup
        </h1>
        <p className="text-slate-500 mt-1">
          Draw your signature to be used on attestation letters
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
          <p className="text-sm text-slate-600">
            Provider: <strong>{provider.name}</strong>,{" "}
            {provider.credentials}
          </p>
        </div>

        {signatureUrl && (
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Current Signature
            </p>
            <div className="bg-slate-50 rounded-lg p-4 inline-block">
              <img
                src={signatureUrl}
                alt="Current signature"
                className="max-h-20"
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">
            {signatureUrl ? "Draw New Signature" : "Draw Signature"}
          </p>
          <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "w-full h-48",
                style: { width: "100%", height: "12rem" },
              }}
              penColor="black"
              backgroundColor="white"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Signature
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
