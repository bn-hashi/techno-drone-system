"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CourseType } from "@/types/prisma";
import { postCreateUser, type CreateUserInput } from "@/lib/api/adminUsers";

export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [courseType, setCourseType] = useState<CourseType>(CourseType.BEGINNER);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation<void, Error, CreateUserInput>({
    mutationFn: postCreateUser,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    setSuccess(false);

    if (!email) {
      setValidationError("メールアドレスは必須です");
      return;
    }

    mutation.mutate(
      { email, name, password, courseType },
      {
        onSuccess: () => {
          setSuccess(true);
          setEmail("");
          setName("");
          setPassword("");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          氏名
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="courseType" className="block text-sm font-medium">
          コースタイプ
        </label>
        <select
          id="courseType"
          value={courseType}
          onChange={(e) => setCourseType(e.target.value as CourseType)}
          className="mt-1 block w-full rounded border px-3 py-2"
        >
          <option value={CourseType.BEGINNER}>初心者コース</option>
          <option value={CourseType.EXPERIENCED}>経験者コース</option>
        </select>
      </div>

      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}
      {mutation.error instanceof Error && (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">受講者を登録しました</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        受講者を登録
      </button>
    </form>
  );
}
