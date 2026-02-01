import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">CardioAuth</h1>
        <p className="text-slate-500 mb-4">AI-Powered Study Authorization</p>
        <p className="text-sm text-slate-400 mb-6">
          Registration is restricted to <strong>@mountsinai.org</strong> email addresses.
        </p>
        <SignUp />
      </div>
    </div>
  );
}
