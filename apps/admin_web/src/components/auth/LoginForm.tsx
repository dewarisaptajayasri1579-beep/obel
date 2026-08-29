"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Button, Alert } from "../ui";
import { UserRound, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

export const LoginForm: React.FC<{ showTopLockIcon?: boolean; className?: string }> = ({
  showTopLockIcon = true,
  className = "",
}) => {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Silakan masukkan username");
      return;
    }
    if (!password.trim()) {
      setError("Silakan masukkan password");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghubungi server, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {showTopLockIcon && (
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#f0f5ff] dark:bg-blue-500/10 text-[#0544cc] dark:text-[var(--accent-primary)] border border-blue-100 dark:border-blue-500/30 flex items-center justify-center shadow-sm">
            <Lock className="w-7 h-7 stroke-[2.2]" />
          </div>
        </div>
      )}

      <h2 className="text-center font-bold text-[#1e293b] dark:text-fg text-lg sm:text-xl mb-6 tracking-tight">
        Masuk untuk melanjutkan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<UserRound className="w-5 h-5 text-slate-600 dark:text-fg-muted" />}
        />

        <Input
          placeholder="Password"
          isPassword
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-5 h-5 text-slate-600 dark:text-fg-muted" />}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading} loadingText="Memproses...">
            Login
          </Button>
        </div>
      </form>
    </div>
  );
};
