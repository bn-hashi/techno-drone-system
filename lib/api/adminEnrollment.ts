export interface CreateEnrollmentInput {
  userId: string;
  dateOfBirth: string; // ISO date string: "YYYY-MM-DD"
  address: string;
  phoneNumber: string;
}

export async function postCreateEnrollment(
  input: CreateEnrollmentInput
): Promise<void> {
  const response = await fetch("/api/admin/enrollment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "申請登録に失敗しました");
  }
}
