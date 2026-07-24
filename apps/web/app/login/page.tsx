import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">Airlink Asset Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
