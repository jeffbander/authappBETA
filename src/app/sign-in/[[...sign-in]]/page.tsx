import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">CardioAuth</h1>
        <p className="text-slate-500 mb-8">AI-Powered Study Authorization</p>
        <SignIn />
      </div>
    </div>
  );
}
