import { listBranches } from '@airlink/core';
import { RegisterForm } from '@/components/RegisterForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const branches = await listBranches();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">
            Register yourself, then add your PC from your profile.
          </p>
        </div>
        <RegisterForm branches={branches.map((b) => ({ id: b.id, name: b.name }))} />
      </div>
    </main>
  );
}
