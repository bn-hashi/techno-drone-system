"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  postCreateEnrollment,
  type CreateEnrollmentInput,
} from "@/lib/api/adminEnrollment";

interface EnrollmentFormProps {
  userId: string;
}

export function EnrollmentForm({ userId }: EnrollmentFormProps) {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation<void, Error, CreateEnrollmentInput>({
    mutationFn: postCreateEnrollment,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    setSuccess(false);

    if (!dateOfBirth) {
      setValidationError("生年月日は必須です");
      return;
    }
    if (!address) {
      setValidationError("住所は必須です");
      return;
    }
    if (!phoneNumber) {
      setValidationError("電話番号は必須です");
      return;
    }

    mutation.mutate(
      { userId, dateOfBirth, address, phoneNumber },
      {
        onSuccess: () => {
          setSuccess(true);
          setDateOfBirth("");
          setAddress("");
          setPhoneNumber("");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium">
          生年月日
        </label>
        <input
          id="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          住所
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-medium">
          電話番号
        </label>
        <input
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}
      {mutation.error instanceof Error && (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">入学申請を登録しました</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        申請を登録
      </button>
    </form>
  );
}
